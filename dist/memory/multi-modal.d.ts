/**
 * Multi-Modal Memory - Ralph Iteration 5 Feature 1
 *
 * Extends the memory system to handle images and structured data.
 * Uses Claude's vision capability for image analysis and description.
 */
import { MemoryStore } from './store.js';
import { Stance } from '../types/index.js';
/**
 * Supported image formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp';
/**
 * Multi-modal memory entry
 */
export interface MultiModalMemory {
    id: string;
    type: 'image' | 'diagram' | 'screenshot' | 'chart';
    format: ImageFormat;
    filePath: string;
    hash: string;
    description: string;
    analysis?: ImageAnalysis;
    embedding?: number[];
    tags: string[];
    createdAt: Date;
    importance: number;
    relatedMemories: string[];
}
/**
 * Image analysis result from Claude vision
 */
export interface ImageAnalysis {
    summary: string;
    objects: string[];
    text: string[];
    colors: string[];
    mood?: string;
    technicalDetails?: string;
    stanceRelevance?: string;
}
/**
 * Multi-modal search options
 */
export interface MultiModalSearchOptions {
    type?: MultiModalMemory['type'];
    tags?: string[];
    minImportance?: number;
    limit?: number;
    similarTo?: string;
}
/**
 * Multi-modal memory configuration
 */
export interface MultiModalConfig {
    enabled: boolean;
    storageDir: string;
    maxImageSize: number;
    autoAnalyze: boolean;
    generateEmbeddings: boolean;
}
/**
 * Multi-Modal Memory Manager
 */
declare class MultiModalMemoryManager {
    private config;
    private memories;
    private _memoryStore;
    /**
     * Set configuration
     */
    setConfig(config: Partial<MultiModalConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): MultiModalConfig;
    /**
     * Set memory store reference for linking
     */
    setMemoryStore(store: MemoryStore): void;
    /**
     * Get memory store reference
     */
    getMemoryStore(): MemoryStore | null;
    /**
     * Ensure storage directory exists
     */
    private ensureStorageDir;
    /**
     * Calculate file hash
     */
    private hashFile;
    /**
     * Detect image format from buffer
     */
    private detectFormat;
    /**
     * Store an image from file path
     */
    storeImage(filePath: string, options?: {
        type?: MultiModalMemory['type'];
        description?: string;
        tags?: string[];
        importance?: number;
    }): Promise<MultiModalMemory | null>;
    /**
     * Store an image from buffer
     */
    storeImageBuffer(data: Buffer, options?: {
        type?: MultiModalMemory['type'];
        description?: string;
        tags?: string[];
        importance?: number;
        originalPath?: string;
    }): Promise<MultiModalMemory | null>;
    /**
     * Analyze an image (stub - requires Claude API integration)
     */
    analyzeImage(imageId: string, stance?: Stance): Promise<ImageAnalysis | null>;
    /**
     * Generate description prompt for Claude vision
     */
    generateAnalysisPrompt(stance?: Stance): string;
    /**
     * Get image as base64 (for API calls)
     */
    getImageBase64(imageId: string): string | null;
    /**
     * Search multi-modal memories
     */
    search(options: MultiModalSearchOptions): MultiModalMemory[];
    /**
     * Get memory by ID
     */
    getMemory(id: string): MultiModalMemory | null;
    /**
     * Update memory metadata
     */
    updateMemory(id: string, updates: Partial<MultiModalMemory>): boolean;
    /**
     * Link to text memory
     */
    linkToTextMemory(imageId: string, textMemoryId: string): boolean;
    /**
     * Delete memory
     */
    deleteMemory(id: string): boolean;
    /**
     * Get all memories
     */
    getAllMemories(): MultiModalMemory[];
    /**
     * Get statistics
     */
    getStats(): {
        totalImages: number;
        byType: Record<string, number>;
        totalSize: number;
        analyzed: number;
    };
    /**
     * Clear all memories
     */
    clear(): void;
}
export declare const multiModalMemory: MultiModalMemoryManager;
export {};
//# sourceMappingURL=multi-modal.d.ts.map