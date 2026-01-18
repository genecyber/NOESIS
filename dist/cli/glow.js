/**
 * Glow Integration - Terminal Markdown Rendering
 *
 * Provides optional support for https://github.com/charmbracelet/glow
 * Falls back gracefully when glow is not installed.
 *
 * Ported from hustle-v5 with METAMORPH adaptations.
 */
import { spawn, spawnSync } from 'child_process';
// ============================================================================
// State
// ============================================================================
let glowInfo = null;
let config = {
    enabled: true, // Enabled by default if glow is installed
    style: 'dark',
    width: undefined, // Use terminal width
};
// ============================================================================
// Detection
// ============================================================================
/**
 * Check if glow is installed and get version info
 * Uses spawnSync to avoid shell injection vulnerabilities
 */
export function detectGlow() {
    if (glowInfo !== null) {
        return glowInfo;
    }
    try {
        const result = spawnSync('glow', ['--version'], {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (result.error || result.status !== 0) {
            glowInfo = { installed: false };
            return glowInfo;
        }
        const versionOutput = (result.stdout || '').trim();
        const versionMatch = versionOutput.match(/glow\s+(?:version\s+)?(\d+\.\d+\.\d+)/i);
        const version = versionMatch?.[1];
        let glowPath;
        try {
            const whichCmd = process.platform === 'win32' ? 'where' : 'which';
            const pathResult = spawnSync(whichCmd, ['glow'], {
                encoding: 'utf-8',
                timeout: 5000,
            });
            if (pathResult.status === 0 && pathResult.stdout) {
                glowPath = pathResult.stdout.trim().split('\n')[0];
            }
        }
        catch {
            // Path detection failed, but glow still works
        }
        glowInfo = {
            installed: true,
            version,
            path: glowPath,
        };
    }
    catch {
        glowInfo = { installed: false };
    }
    return glowInfo;
}
/**
 * Reset cached glow detection
 */
export function resetGlowCache() {
    glowInfo = null;
}
/**
 * Check if glow is available and enabled
 */
export function isGlowAvailable() {
    const info = detectGlow();
    return info.installed && config.enabled;
}
/**
 * Get glow installation status
 */
export function getGlowStatus() {
    return {
        info: detectGlow(),
        config: { ...config },
    };
}
// ============================================================================
// Configuration
// ============================================================================
/**
 * Enable glow rendering (if installed)
 */
export function enableGlow() {
    const info = detectGlow();
    if (info.installed) {
        config.enabled = true;
        return true;
    }
    return false;
}
/**
 * Disable glow rendering
 */
export function disableGlow() {
    config.enabled = false;
}
/**
 * Set glow style
 */
export function setGlowStyle(style) {
    config.style = style;
}
/**
 * Set glow width
 */
export function setGlowWidth(width) {
    config.width = width;
}
// ============================================================================
// Rendering
// ============================================================================
function buildGlowArgs() {
    const args = ['-']; // Read from stdin
    if (config.style) {
        args.push('-s', config.style);
    }
    if (config.width) {
        args.push('-w', config.width.toString());
    }
    return args;
}
/**
 * Render markdown through glow (async)
 */
export async function renderMarkdown(markdown) {
    if (!isGlowAvailable()) {
        return markdown;
    }
    return new Promise((resolve) => {
        const args = buildGlowArgs();
        const glow = spawn('glow', args, {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        glow.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        glow.on('close', (code) => {
            if (code === 0 && stdout) {
                resolve(stdout);
            }
            else {
                resolve(markdown);
            }
        });
        glow.on('error', () => {
            resolve(markdown);
        });
        glow.stdin.write(markdown);
        glow.stdin.end();
        setTimeout(() => {
            glow.kill();
            resolve(markdown);
        }, 5000);
    });
}
/**
 * Render markdown through glow (sync)
 */
export function renderMarkdownSync(markdown) {
    if (!isGlowAvailable()) {
        return markdown;
    }
    try {
        const args = buildGlowArgs();
        const result = spawnSync('glow', args, {
            input: markdown,
            encoding: 'utf-8',
            timeout: 5000,
            maxBuffer: 10 * 1024 * 1024,
        });
        if (result.error || result.status !== 0) {
            return markdown;
        }
        return result.stdout || markdown;
    }
    catch {
        return markdown;
    }
}
// ============================================================================
// Streaming Buffer for Incremental Rendering
// ============================================================================
/**
 * Buffer for streaming markdown through glow at safe breakpoints.
 */
export class GlowStreamBuffer {
    buffer = '';
    inCodeBlock = false;
    codeBlockFence = '';
    lastRenderedLength = 0;
    /**
     * Add content to the buffer and return any content ready to render.
     */
    push(delta) {
        this.buffer += delta;
        return this.tryFlush();
    }
    /**
     * Flush any remaining content (call at end of stream).
     */
    flush() {
        if (this.buffer.length === 0) {
            return null;
        }
        const content = this.buffer;
        this.buffer = '';
        this.inCodeBlock = false;
        this.codeBlockFence = '';
        if (!isGlowAvailable()) {
            return content;
        }
        return renderMarkdownSync(content);
    }
    /**
     * Reset the buffer state.
     */
    reset() {
        this.buffer = '';
        this.inCodeBlock = false;
        this.codeBlockFence = '';
        this.lastRenderedLength = 0;
    }
    tryFlush() {
        this.updateCodeBlockState();
        if (this.inCodeBlock) {
            return null;
        }
        const breakpoint = this.findBreakpoint();
        if (breakpoint === -1) {
            return null;
        }
        const content = this.buffer.slice(0, breakpoint);
        this.buffer = this.buffer.slice(breakpoint);
        if (content.length === 0) {
            return null;
        }
        if (!isGlowAvailable()) {
            return content;
        }
        return renderMarkdownSync(content);
    }
    updateCodeBlockState() {
        const fenceRegex = /^(```|~~~)/gm;
        const newContent = this.buffer.slice(this.lastRenderedLength);
        const matches = [...newContent.matchAll(fenceRegex)];
        for (const match of matches) {
            const fence = match[1];
            if (!this.inCodeBlock) {
                this.inCodeBlock = true;
                this.codeBlockFence = fence;
            }
            else if (fence === this.codeBlockFence) {
                this.inCodeBlock = false;
                this.codeBlockFence = '';
            }
        }
        this.lastRenderedLength = this.buffer.length;
    }
    findBreakpoint() {
        const paragraphBreak = this.buffer.indexOf('\n\n');
        if (paragraphBreak !== -1) {
            return paragraphBreak + 2;
        }
        if (this.buffer.endsWith('\n') && this.buffer.length > 1) {
            const lines = this.buffer.split('\n');
            if (lines.length >= 2) {
                const lastLine = lines[lines.length - 2];
                if (this.isBlockElement(lastLine)) {
                    return this.buffer.length;
                }
            }
        }
        return -1;
    }
    isBlockElement(line) {
        const trimmed = line.trim();
        if (/^#{1,6}\s/.test(trimmed)) {
            return true;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            return true;
        }
        return false;
    }
}
/**
 * Create a new glow stream buffer.
 */
export function createGlowStreamBuffer() {
    return new GlowStreamBuffer();
}
// ============================================================================
// Installation Helpers
// ============================================================================
/**
 * Get installation instructions for the current platform
 */
export function getInstallInstructions() {
    const platform = process.platform;
    const instructions = [
        'Glow is a terminal markdown renderer from Charmbracelet.',
        'https://github.com/charmbracelet/glow',
        '',
        'Installation options:',
        '',
    ];
    if (platform === 'darwin') {
        instructions.push('  macOS (Homebrew):');
        instructions.push('    brew install glow');
    }
    else if (platform === 'linux') {
        instructions.push('  Debian/Ubuntu:');
        instructions.push('    sudo apt install glow');
        instructions.push('');
        instructions.push('  Arch Linux:');
        instructions.push('    sudo pacman -S glow');
    }
    else if (platform === 'win32') {
        instructions.push('  Windows (Scoop):');
        instructions.push('    scoop install glow');
    }
    instructions.push('');
    instructions.push('  Cross-platform (Go):');
    instructions.push('    go install github.com/charmbracelet/glow@latest');
    return instructions.join('\n');
}
export default {
    detectGlow,
    resetGlowCache,
    isGlowAvailable,
    getGlowStatus,
    enableGlow,
    disableGlow,
    setGlowStyle,
    setGlowWidth,
    renderMarkdown,
    renderMarkdownSync,
    getInstallInstructions,
    GlowStreamBuffer,
    createGlowStreamBuffer,
};
//# sourceMappingURL=glow.js.map