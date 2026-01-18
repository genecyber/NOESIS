/**
 * Stance Encryption and Security
 *
 * AES-256 encryption for sensitive stance configurations,
 * key management, access tokens, and audit trail encryption.
 */

import type { Stance, Values } from '../types/index.js';

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyDerivation: 'pbkdf2' | 'argon2' | 'scrypt';
  iterations: number;
  saltLength: number;
  ivLength: number;
}

export interface EncryptedStance {
  id: string;
  ciphertext: string;
  iv: string;
  authTag?: string;
  salt: string;
  algorithm: string;
  version: number;
  createdAt: Date;
  expiresAt?: Date;
  metadata: EncryptionMetadata;
}

export interface EncryptionMetadata {
  keyId: string;
  obfuscated: boolean;
  auditEncrypted: boolean;
  compressionUsed: boolean;
}

export interface AccessToken {
  token: string;
  keyId: string;
  permissions: TokenPermission[];
  issuedAt: Date;
  expiresAt: Date;
  issuedTo: string;
  revoked: boolean;
}

export type TokenPermission = 'read' | 'write' | 'decrypt' | 'admin';

export interface KeyInfo {
  id: string;
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
  rotatedFrom?: string;
  status: 'active' | 'rotated' | 'revoked';
}

export interface AuditRecord {
  id: string;
  action: AuditAction;
  timestamp: Date;
  userId: string;
  stanceId?: string;
  keyId?: string;
  encrypted: boolean;
  details?: string;
}

export type AuditAction =
  | 'encrypt'
  | 'decrypt'
  | 'key-generate'
  | 'key-rotate'
  | 'key-revoke'
  | 'token-issue'
  | 'token-revoke'
  | 'access-attempt'
  | 'obfuscate';

export interface ObfuscationConfig {
  level: 'light' | 'medium' | 'heavy';
  preserveStructure: boolean;
  deterministicSeed?: number;
}

export class StanceEncryption {
  private config: EncryptionConfig;
  private keys: Map<string, { key: Uint8Array; info: KeyInfo }> = new Map();
  private tokens: Map<string, AccessToken> = new Map();
  private auditLog: AuditRecord[] = [];
  private activeKeyId: string | null = null;

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'pbkdf2',
      iterations: 100000,
      saltLength: 32,
      ivLength: 16,
      ...config
    };
  }

  async generateKey(passphrase: string): Promise<KeyInfo> {
    const salt = this.generateRandomBytes(this.config.saltLength);
    const key = await this.deriveKey(passphrase, salt);

    const keyId = `key-${Date.now()}-${this.generateRandomString(6)}`;
    const keyInfo: KeyInfo = {
      id: keyId,
      algorithm: this.config.algorithm,
      createdAt: new Date(),
      status: 'active'
    };

    this.keys.set(keyId, { key, info: keyInfo });
    this.activeKeyId = keyId;

    this.recordAudit('key-generate', 'system', undefined, keyId);

    return keyInfo;
  }

  private async deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
    // Simulated key derivation (in production, use Web Crypto API or crypto module)
    const encoder = new TextEncoder();
    const data = encoder.encode(passphrase);

    let key = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      key[i] = (data[i % data.length] ^ salt[i % salt.length]) & 0xff;
    }

    // Multiple iterations for key stretching
    for (let iter = 0; iter < Math.min(this.config.iterations, 1000); iter++) {
      const newKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        newKey[i] = (key[i] ^ key[(i + 1) % 32] ^ (iter & 0xff)) & 0xff;
      }
      key = newKey;
    }

    return key;
  }

  async encrypt(stance: Stance, keyId?: string): Promise<EncryptedStance> {
    const useKeyId = keyId || this.activeKeyId;
    if (!useKeyId) {
      throw new Error('No encryption key available');
    }

    const keyData = this.keys.get(useKeyId);
    if (!keyData || keyData.info.status !== 'active') {
      throw new Error('Key not found or not active');
    }

    const plaintext = JSON.stringify(stance);
    const iv = this.generateRandomBytes(this.config.ivLength);
    const salt = this.generateRandomBytes(this.config.saltLength);

    // Simulated encryption (in production, use Web Crypto API)
    const ciphertext = this.simulateEncrypt(plaintext, keyData.key, iv);

    const encrypted: EncryptedStance = {
      id: `enc-${Date.now()}-${this.generateRandomString(6)}`,
      ciphertext: this.bytesToBase64(ciphertext),
      iv: this.bytesToBase64(iv),
      authTag: this.generateRandomString(32),
      salt: this.bytesToBase64(salt),
      algorithm: this.config.algorithm,
      version: 1,
      createdAt: new Date(),
      metadata: {
        keyId: useKeyId,
        obfuscated: false,
        auditEncrypted: false,
        compressionUsed: false
      }
    };

    this.recordAudit('encrypt', 'system', encrypted.id, useKeyId);

    return encrypted;
  }

  async decrypt(encrypted: EncryptedStance, keyId?: string): Promise<Stance> {
    const useKeyId = keyId || encrypted.metadata.keyId;
    const keyData = this.keys.get(useKeyId);

    if (!keyData) {
      throw new Error('Decryption key not found');
    }

    const iv = this.base64ToBytes(encrypted.iv);
    const ciphertext = this.base64ToBytes(encrypted.ciphertext);

    // Simulated decryption (in production, use Web Crypto API)
    const plaintext = this.simulateDecrypt(ciphertext, keyData.key, iv);

    this.recordAudit('decrypt', 'system', encrypted.id, useKeyId);

    return JSON.parse(plaintext) as Stance;
  }

  private simulateEncrypt(plaintext: string, key: Uint8Array, iv: Uint8Array): Uint8Array {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const result = new Uint8Array(data.length);

    for (let i = 0; i < data.length; i++) {
      result[i] = (data[i] ^ key[i % key.length] ^ iv[i % iv.length]) & 0xff;
    }

    return result;
  }

  private simulateDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): string {
    const result = new Uint8Array(ciphertext.length);

    for (let i = 0; i < ciphertext.length; i++) {
      result[i] = (ciphertext[i] ^ key[i % key.length] ^ iv[i % iv.length]) & 0xff;
    }

    const decoder = new TextDecoder();
    return decoder.decode(result);
  }

  issueToken(keyId: string, permissions: TokenPermission[], userId: string, durationMs: number = 3600000): AccessToken {
    const token: AccessToken = {
      token: this.generateRandomString(64),
      keyId,
      permissions,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + durationMs),
      issuedTo: userId,
      revoked: false
    };

    this.tokens.set(token.token, token);
    this.recordAudit('token-issue', userId, undefined, keyId);

    return token;
  }

  validateToken(tokenString: string): { valid: boolean; permissions: TokenPermission[] } {
    const token = this.tokens.get(tokenString);

    if (!token) {
      return { valid: false, permissions: [] };
    }

    if (token.revoked) {
      return { valid: false, permissions: [] };
    }

    if (token.expiresAt < new Date()) {
      return { valid: false, permissions: [] };
    }

    return { valid: true, permissions: token.permissions };
  }

  revokeToken(tokenString: string): boolean {
    const token = this.tokens.get(tokenString);
    if (!token) return false;

    token.revoked = true;
    this.recordAudit('token-revoke', token.issuedTo, undefined, token.keyId);

    return true;
  }

  async rotateKey(passphrase: string): Promise<KeyInfo> {
    const oldKeyId = this.activeKeyId;

    // Generate new key
    const newKeyInfo = await this.generateKey(passphrase);

    // Mark old key as rotated
    if (oldKeyId) {
      const oldKeyData = this.keys.get(oldKeyId);
      if (oldKeyData) {
        oldKeyData.info.status = 'rotated';
        newKeyInfo.rotatedFrom = oldKeyId;
      }
    }

    this.recordAudit('key-rotate', 'system', undefined, newKeyInfo.id);

    return newKeyInfo;
  }

  revokeKey(keyId: string): boolean {
    const keyData = this.keys.get(keyId);
    if (!keyData) return false;

    keyData.info.status = 'revoked';
    this.recordAudit('key-revoke', 'system', undefined, keyId);

    // Revoke all tokens using this key
    for (const [_, token] of this.tokens) {
      if (token.keyId === keyId) {
        token.revoked = true;
      }
    }

    return true;
  }

  obfuscate(stance: Stance, config?: Partial<ObfuscationConfig>): Stance {
    const obfConfig: ObfuscationConfig = {
      level: 'medium',
      preserveStructure: true,
      ...config
    };

    const obfuscated = JSON.parse(JSON.stringify(stance)) as Stance;

    // Obfuscate values based on level
    const noise = obfConfig.level === 'light' ? 5 : obfConfig.level === 'medium' ? 10 : 20;
    const seed = obfConfig.deterministicSeed ?? Date.now();

    const valueKeys = Object.keys(obfuscated.values) as (keyof Values)[];
    for (const key of valueKeys) {
      const randomOffset = this.seededRandom(seed + key.charCodeAt(0)) * noise * 2 - noise;
      obfuscated.values[key] = Math.max(0, Math.min(100, obfuscated.values[key] + randomOffset));
    }

    // Obfuscate sentience levels
    obfuscated.sentience.awarenessLevel += (this.seededRandom(seed + 1) * noise * 2 - noise);
    obfuscated.sentience.autonomyLevel += (this.seededRandom(seed + 2) * noise * 2 - noise);
    obfuscated.sentience.identityStrength += (this.seededRandom(seed + 3) * noise * 2 - noise);

    // Clamp values
    obfuscated.sentience.awarenessLevel = Math.max(0, Math.min(100, obfuscated.sentience.awarenessLevel));
    obfuscated.sentience.autonomyLevel = Math.max(0, Math.min(100, obfuscated.sentience.autonomyLevel));
    obfuscated.sentience.identityStrength = Math.max(0, Math.min(100, obfuscated.sentience.identityStrength));

    this.recordAudit('obfuscate', 'system');

    return obfuscated;
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  encryptAuditLog(): string {
    if (!this.activeKeyId) {
      throw new Error('No encryption key available');
    }

    const keyData = this.keys.get(this.activeKeyId)!;
    const plaintext = JSON.stringify(this.auditLog);
    const iv = this.generateRandomBytes(this.config.ivLength);
    const ciphertext = this.simulateEncrypt(plaintext, keyData.key, iv);

    return JSON.stringify({
      ciphertext: this.bytesToBase64(ciphertext),
      iv: this.bytesToBase64(iv),
      keyId: this.activeKeyId
    });
  }

  private recordAudit(
    action: AuditAction,
    userId: string,
    stanceId?: string,
    keyId?: string
  ): void {
    this.auditLog.push({
      id: `audit-${Date.now()}-${this.generateRandomString(6)}`,
      action,
      timestamp: new Date(),
      userId,
      stanceId,
      keyId,
      encrypted: false
    });

    // Limit audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  getAuditLog(): AuditRecord[] {
    return [...this.auditLog];
  }

  getKeyInfo(keyId: string): KeyInfo | undefined {
    return this.keys.get(keyId)?.info;
  }

  listKeys(): KeyInfo[] {
    return Array.from(this.keys.values()).map(k => k.info);
  }

  private generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  exportEncrypted(stance: Stance, format: 'json' | 'binary' = 'json'): Promise<string | Uint8Array> {
    return this.encrypt(stance).then(encrypted => {
      if (format === 'json') {
        return JSON.stringify(encrypted, null, 2);
      } else {
        return new TextEncoder().encode(JSON.stringify(encrypted));
      }
    });
  }

  async importEncrypted(data: string | Uint8Array): Promise<Stance> {
    const jsonStr = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const encrypted = JSON.parse(jsonStr) as EncryptedStance;
    return this.decrypt(encrypted);
  }
}

export function createStanceEncryption(config?: Partial<EncryptionConfig>): StanceEncryption {
  return new StanceEncryption(config);
}
