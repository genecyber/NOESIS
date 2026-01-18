/**
 * Glow Integration - Terminal Markdown Rendering
 *
 * Provides optional support for https://github.com/charmbracelet/glow
 * Falls back gracefully when glow is not installed.
 *
 * Ported from hustle-v5 with METAMORPH adaptations.
 */
export interface GlowConfig {
    enabled: boolean;
    style?: 'dark' | 'light' | 'notty' | 'auto';
    width?: number;
}
interface GlowInfo {
    installed: boolean;
    version?: string;
    path?: string;
}
/**
 * Check if glow is installed and get version info
 * Uses spawnSync to avoid shell injection vulnerabilities
 */
export declare function detectGlow(): GlowInfo;
/**
 * Reset cached glow detection
 */
export declare function resetGlowCache(): void;
/**
 * Check if glow is available and enabled
 */
export declare function isGlowAvailable(): boolean;
/**
 * Get glow installation status
 */
export declare function getGlowStatus(): {
    info: GlowInfo;
    config: GlowConfig;
};
/**
 * Enable glow rendering (if installed)
 */
export declare function enableGlow(): boolean;
/**
 * Disable glow rendering
 */
export declare function disableGlow(): void;
/**
 * Set glow style
 */
export declare function setGlowStyle(style: GlowConfig['style']): void;
/**
 * Set glow width
 */
export declare function setGlowWidth(width: number | undefined): void;
/**
 * Render markdown through glow (async)
 */
export declare function renderMarkdown(markdown: string): Promise<string>;
/**
 * Render markdown through glow (sync)
 */
export declare function renderMarkdownSync(markdown: string): string;
/**
 * Buffer for streaming markdown through glow at safe breakpoints.
 */
export declare class GlowStreamBuffer {
    private buffer;
    private inCodeBlock;
    private codeBlockFence;
    private lastRenderedLength;
    /**
     * Add content to the buffer and return any content ready to render.
     */
    push(delta: string): string | null;
    /**
     * Flush any remaining content (call at end of stream).
     */
    flush(): string | null;
    /**
     * Reset the buffer state.
     */
    reset(): void;
    private tryFlush;
    private updateCodeBlockState;
    private findBreakpoint;
    private isBlockElement;
}
/**
 * Create a new glow stream buffer.
 */
export declare function createGlowStreamBuffer(): GlowStreamBuffer;
/**
 * Get installation instructions for the current platform
 */
export declare function getInstallInstructions(): string;
declare const _default: {
    detectGlow: typeof detectGlow;
    resetGlowCache: typeof resetGlowCache;
    isGlowAvailable: typeof isGlowAvailable;
    getGlowStatus: typeof getGlowStatus;
    enableGlow: typeof enableGlow;
    disableGlow: typeof disableGlow;
    setGlowStyle: typeof setGlowStyle;
    setGlowWidth: typeof setGlowWidth;
    renderMarkdown: typeof renderMarkdown;
    renderMarkdownSync: typeof renderMarkdownSync;
    getInstallInstructions: typeof getInstallInstructions;
    GlowStreamBuffer: typeof GlowStreamBuffer;
    createGlowStreamBuffer: typeof createGlowStreamBuffer;
};
export default _default;
//# sourceMappingURL=glow.d.ts.map