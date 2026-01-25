/**
 * SandboxManager - Manages per-vault isolated code execution environments
 *
 * This module provides sandboxed execution capabilities for multi-tenant scenarios
 * where each vault needs isolated code execution. It uses Vercel Sandbox for
 * production environments (cloud-based MicroVMs) and falls back to Node.js vm
 * module for local development or when Vercel credentials are unavailable.
 *
 * Key features:
 * - LRU caching of sandbox instances to optimize resource usage
 * - Per-vault isolation (code from vault A cannot access vault B's data)
 * - Resource limits (memory, CPU time)
 * - Safe module access via allowlist
 * - Automatic cleanup on eviction
 */

import * as vm from 'vm';

// Try to import Vercel Sandbox - may not be available in all environments
let VercelSandbox: typeof import('@vercel/sandbox').Sandbox | null = null;

// Initialize Vercel Sandbox import asynchronously
const initVercelSandbox = async () => {
  try {
    const vercelModule = await import('@vercel/sandbox');
    VercelSandbox = vercelModule.Sandbox;
    console.log('[SandboxManager] Vercel Sandbox SDK loaded successfully');
  } catch {
    console.log('[SandboxManager] @vercel/sandbox not available, using vm fallback');
  }
};

// Start loading Vercel Sandbox immediately (non-blocking)
initVercelSandbox();

/**
 * Configuration for sandbox resource limits and permissions
 */
export interface SandboxConfig {
  /** Maximum memory in megabytes (applies to Vercel Sandbox vCPUs) */
  memoryLimitMB: number;
  /** Maximum execution time in milliseconds */
  timeoutMs: number;
  /** List of modules that can be required in the sandbox */
  allowedModules: string[];
}

/**
 * Result of executing code in a sandbox
 */
export interface ExecutionResult {
  /** Whether execution completed successfully */
  success: boolean;
  /** The return value from the executed code */
  output?: any;
  /** Error message if execution failed */
  error?: string;
  /** How long execution took in milliseconds */
  executionTimeMs: number;
}

/**
 * Internal representation of a pooled sandbox instance
 */
interface PooledSandbox {
  /** The sandbox instance (Vercel Sandbox or vm.Context) */
  sandbox: any;
  /** Timestamp of last access for LRU eviction */
  lastAccess: number;
  /** Type of sandbox for cleanup handling */
  type: 'vercel' | 'vm';
  /** Associated context for vm sandboxes */
  vmContext?: vm.Context;
}

/**
 * Default configuration for sandboxes
 */
const DEFAULT_CONFIG: SandboxConfig = {
  memoryLimitMB: 128,
  timeoutMs: 30000, // 30 seconds
  allowedModules: [
    'path',
    'url',
    'crypto',
    'querystring',
    'util',
    'buffer',
    'events',
    'stream',
  ],
};

/**
 * Safe built-in objects to expose in vm sandboxes
 * Dynamic code generation is disabled via codeGeneration options
 */
const SAFE_GLOBALS: Record<string, any> = {
  // Core JavaScript globals
  Object,
  Array,
  String,
  Number,
  Boolean,
  Date,
  RegExp,
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  ReferenceError,
  EvalError,
  URIError,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Symbol,
  Promise,
  Proxy,
  Reflect,

  // Math and encoding
  Math,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURI,
  encodeURIComponent,
  decodeURI,
  decodeURIComponent,

  // Typed arrays
  ArrayBuffer,
  SharedArrayBuffer,
  DataView,
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
  BigInt,

  // Console (wrapped for safety)
  console: {
    log: (...args: any[]) => console.log('[Sandbox]', ...args),
    error: (...args: any[]) => console.error('[Sandbox]', ...args),
    warn: (...args: any[]) => console.warn('[Sandbox]', ...args),
    info: (...args: any[]) => console.info('[Sandbox]', ...args),
    debug: (...args: any[]) => console.debug('[Sandbox]', ...args),
  },

  // Timing (disabled by default for security)
  setTimeout: undefined,
  setInterval: undefined,
  clearTimeout: undefined,
  clearInterval: undefined,
};

/**
 * SandboxManager - Manages isolated execution environments per vault
 *
 * Uses LRU caching to maintain a pool of sandboxes and evicts least-recently-used
 * ones when the pool reaches capacity. Supports both Vercel Sandbox (cloud VMs)
 * and local Node.js vm module fallback.
 */
export class SandboxManager {
  private sandboxPool: Map<string, PooledSandbox>;
  private maxPoolSize: number;
  private defaultConfig: SandboxConfig;
  private useVercelSandbox: boolean;

  constructor(options?: {
    maxPoolSize?: number;
    defaultConfig?: Partial<SandboxConfig>;
    forceVmFallback?: boolean;
  }) {
    this.sandboxPool = new Map();
    this.maxPoolSize = options?.maxPoolSize ?? 10;
    this.defaultConfig = { ...DEFAULT_CONFIG, ...options?.defaultConfig };

    // Use Vercel Sandbox if available and credentials are set
    this.useVercelSandbox = !options?.forceVmFallback &&
      VercelSandbox !== null &&
      this.hasVercelCredentials();

    if (this.useVercelSandbox) {
      console.log('[SandboxManager] Using Vercel Sandbox for isolated execution');
    } else {
      console.log('[SandboxManager] Using Node.js vm module for isolated execution');
    }
  }

  /**
   * Check if Vercel credentials are available
   */
  private hasVercelCredentials(): boolean {
    // Check for OIDC token or manual credentials
    return !!(
      process.env.VERCEL_OIDC_TOKEN ||
      (process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID)
    );
  }

  /**
   * Get or create a sandbox for a specific vault
   *
   * @param vaultId - Unique identifier for the vault
   * @returns The sandbox instance (either Vercel Sandbox or vm.Context)
   */
  async getOrCreateSandbox(vaultId: string): Promise<any> {
    // Check if we already have a sandbox for this vault
    const existing = this.sandboxPool.get(vaultId);
    if (existing) {
      existing.lastAccess = Date.now();
      return existing.sandbox;
    }

    // Evict LRU if pool is full
    if (this.sandboxPool.size >= this.maxPoolSize) {
      this.evictLRU();
    }

    // Create new sandbox
    const pooledSandbox = await this.createSandbox(vaultId);
    this.sandboxPool.set(vaultId, pooledSandbox);

    return pooledSandbox.sandbox;
  }

  /**
   * Create a new sandbox instance
   */
  private async createSandbox(vaultId: string): Promise<PooledSandbox> {
    if (this.useVercelSandbox && VercelSandbox) {
      return this.createVercelSandbox(vaultId);
    }
    return this.createVmSandbox(vaultId);
  }

  /**
   * Create a Vercel Sandbox instance
   */
  private async createVercelSandbox(vaultId: string): Promise<PooledSandbox> {
    if (!VercelSandbox) {
      throw new Error('Vercel Sandbox not available');
    }

    const createOptions: any = {
      runtime: 'node24',
      timeout: this.defaultConfig.timeoutMs,
      resources: {
        vcpus: Math.min(2, Math.ceil(this.defaultConfig.memoryLimitMB / 64)),
      },
    };

    // Add authentication if using manual credentials
    if (process.env.VERCEL_TOKEN) {
      createOptions.token = process.env.VERCEL_TOKEN;
      createOptions.teamId = process.env.VERCEL_TEAM_ID;
      createOptions.projectId = process.env.VERCEL_PROJECT_ID;
    }

    const sandbox = await VercelSandbox.create(createOptions);

    console.log(`[SandboxManager] Created Vercel Sandbox for vault ${vaultId}: ${sandbox.sandboxId}`);

    return {
      sandbox,
      lastAccess: Date.now(),
      type: 'vercel',
    };
  }

  /**
   * Create a Node.js vm-based sandbox as fallback
   */
  private createVmSandbox(vaultId: string): PooledSandbox {
    // Create restricted require function
    const allowedModules = this.defaultConfig.allowedModules;
    const restrictedRequire = (moduleName: string) => {
      if (!allowedModules.includes(moduleName)) {
        throw new Error(`Module '${moduleName}' is not allowed in sandbox. Allowed: ${allowedModules.join(', ')}`);
      }
      // Use dynamic import pattern for allowed modules only
      switch (moduleName) {
        case 'path': return require('path');
        case 'url': return require('url');
        case 'crypto': return require('crypto');
        case 'querystring': return require('querystring');
        case 'util': return require('util');
        case 'buffer': return require('buffer');
        case 'events': return require('events');
        case 'stream': return require('stream');
        default:
          throw new Error(`Module '${moduleName}' is not allowed in sandbox.`);
      }
    };

    // Create isolated global context
    const contextGlobals: Record<string, any> = {
      ...SAFE_GLOBALS,
      // Vault-specific data store (isolated per vault)
      __vaultData__: new Map<string, any>(),
      __vaultId__: vaultId,
      // Restricted require function
      require: restrictedRequire,
    };

    const vmContext = vm.createContext(contextGlobals, {
      name: `sandbox-${vaultId}`,
      // Prevent code from breaking out of the sandbox
      codeGeneration: {
        strings: false, // Disable dynamic code generation from strings
        wasm: false,    // Disable WebAssembly
      },
    });

    console.log(`[SandboxManager] Created VM sandbox for vault ${vaultId}`);

    return {
      sandbox: vmContext,
      lastAccess: Date.now(),
      type: 'vm',
      vmContext,
    };
  }

  /**
   * Execute code in a vault's sandbox
   *
   * @param vaultId - Unique identifier for the vault
   * @param code - JavaScript code to execute
   * @param context - Optional context variables to inject
   * @returns Execution result with output or error
   */
  async executeSandboxed(
    vaultId: string,
    code: string,
    context?: Record<string, any>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const pooled = this.sandboxPool.get(vaultId);

      if (!pooled) {
        // Create sandbox if it doesn't exist
        await this.getOrCreateSandbox(vaultId);
        return this.executeSandboxed(vaultId, code, context);
      }

      // Update last access time
      pooled.lastAccess = Date.now();

      if (pooled.type === 'vercel') {
        return this.executeInVercelSandbox(pooled.sandbox, code, context, startTime);
      } else {
        return this.executeInVmSandbox(pooled, code, context, startTime);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute code in Vercel Sandbox
   */
  private async executeInVercelSandbox(
    sandbox: any,
    code: string,
    context: Record<string, any> | undefined,
    startTime: number
  ): Promise<ExecutionResult> {
    try {
      // Write the code to a file in the sandbox
      const codeWithContext = context
        ? `const __context__ = ${JSON.stringify(context)};\n${code}`
        : code;

      await sandbox.writeFiles([
        { path: 'execute.js', content: Buffer.from(codeWithContext) }
      ]);

      // Execute the code using node
      const result = await sandbox.runCommand({
        cmd: 'node',
        args: ['execute.js'],
        cwd: '/vercel/sandbox',
      });

      const stdout = await result.stdout();
      const stderr = await result.stderr();

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: stderr || `Exit code: ${result.exitCode}`,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Try to parse output as JSON, otherwise return as string
      let output: any;
      try {
        output = JSON.parse(stdout);
      } catch {
        output = stdout;
      }

      return {
        success: true,
        output,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute code in vm sandbox
   */
  private executeInVmSandbox(
    pooled: PooledSandbox,
    code: string,
    context: Record<string, any> | undefined,
    startTime: number
  ): ExecutionResult {
    try {
      const vmContext = pooled.vmContext!;

      // Inject context variables if provided
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          vmContext[key] = value;
        }
      }

      // Create script with explicit handling
      const wrappedCode = `
        (function() {
          try {
            const __result__ = (function() {
              ${code}
            })();
            return { success: true, value: __result__ };
          } catch (e) {
            return { success: false, error: e.message || String(e) };
          }
        })()
      `;

      const script = new vm.Script(wrappedCode, {
        filename: `sandbox-${pooled.sandbox.__vaultId__}.js`,
        lineOffset: 0,
        columnOffset: 0,
      });

      const result = script.runInContext(vmContext, {
        timeout: this.defaultConfig.timeoutMs,
        displayErrors: true,
      });

      // Clean up injected context
      if (context) {
        for (const key of Object.keys(context)) {
          delete vmContext[key];
        }
      }

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        return {
          success: true,
          output: result.value,
          executionTimeMs,
        };
      } else {
        return {
          success: false,
          error: result.error,
          executionTimeMs,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Cleanup and destroy a sandbox for a specific vault
   *
   * @param vaultId - Unique identifier for the vault
   */
  async destroySandbox(vaultId: string): Promise<void> {
    const pooled = this.sandboxPool.get(vaultId);
    if (!pooled) {
      return;
    }

    try {
      if (pooled.type === 'vercel') {
        await pooled.sandbox.stop();
        console.log(`[SandboxManager] Stopped Vercel Sandbox for vault ${vaultId}`);
      } else {
        // For vm sandboxes, clear the context
        if (pooled.vmContext) {
          for (const key of Object.keys(pooled.vmContext)) {
            delete pooled.vmContext[key];
          }
        }
        console.log(`[SandboxManager] Cleared VM sandbox for vault ${vaultId}`);
      }
    } catch (error) {
      console.error(`[SandboxManager] Error destroying sandbox for vault ${vaultId}:`, error);
    }

    this.sandboxPool.delete(vaultId);
  }

  /**
   * Evict the least recently used sandbox from the pool
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    const entries = Array.from(this.sandboxPool.entries());
    for (const [key, value] of entries) {
      if (value.lastAccess < oldestAccess) {
        oldestAccess = value.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      console.log(`[SandboxManager] Evicting LRU sandbox for vault ${oldestKey}`);
      // Fire and forget cleanup
      this.destroySandbox(oldestKey).catch(err => {
        console.error(`[SandboxManager] Error during LRU eviction:`, err);
      });
    }
  }

  /**
   * Cleanup all sandboxes (call on server shutdown)
   */
  async shutdown(): Promise<void> {
    console.log(`[SandboxManager] Shutting down ${this.sandboxPool.size} sandboxes...`);

    const cleanupPromises = Array.from(this.sandboxPool.keys()).map(vaultId =>
      this.destroySandbox(vaultId)
    );

    await Promise.all(cleanupPromises);

    console.log('[SandboxManager] All sandboxes shut down');
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    activeCount: number;
    maxPoolSize: number;
    sandboxType: 'vercel' | 'vm';
    vaults: string[];
  } {
    return {
      activeCount: this.sandboxPool.size,
      maxPoolSize: this.maxPoolSize,
      sandboxType: this.useVercelSandbox ? 'vercel' : 'vm',
      vaults: Array.from(this.sandboxPool.keys()),
    };
  }

  /**
   * Check if a vault has an active sandbox
   */
  hasSandbox(vaultId: string): boolean {
    return this.sandboxPool.has(vaultId);
  }

  /**
   * Get the remaining timeout for a sandbox (if Vercel)
   */
  async getSandboxTimeout(vaultId: string): Promise<number | null> {
    const pooled = this.sandboxPool.get(vaultId);
    if (!pooled || pooled.type !== 'vercel') {
      return null;
    }

    return pooled.sandbox.timeout;
  }

  /**
   * Extend the timeout for a Vercel sandbox
   */
  async extendSandboxTimeout(vaultId: string, durationMs: number): Promise<boolean> {
    const pooled = this.sandboxPool.get(vaultId);
    if (!pooled || pooled.type !== 'vercel') {
      return false;
    }

    try {
      await pooled.sandbox.extendTimeout(durationMs);
      return true;
    } catch (error) {
      console.error(`[SandboxManager] Failed to extend timeout for vault ${vaultId}:`, error);
      return false;
    }
  }
}

/**
 * Default singleton instance for the application
 */
export const sandboxManager = new SandboxManager();

export default SandboxManager;
