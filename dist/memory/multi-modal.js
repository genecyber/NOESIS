/**
 * Multi-Modal Memory - Ralph Iteration 5 Feature 1
 *
 * Extends the memory system to handle images and structured data.
 * Uses Claude's vision capability for image analysis and description.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
const DEFAULT_CONFIG = {
    enabled: true,
    storageDir: './data/images',
    maxImageSize: 10 * 1024 * 1024, // 10MB
    autoAnalyze: true,
    generateEmbeddings: true
};
/**
 * Multi-Modal Memory Manager
 */
class MultiModalMemoryManager {
    config = DEFAULT_CONFIG;
    memories = new Map();
    _memoryStore = null;
    /**
     * Set configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
        // Ensure storage directory exists
        if (this.config.enabled && this.config.storageDir) {
            this.ensureStorageDir();
        }
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Set memory store reference for linking
     */
    setMemoryStore(store) {
        this._memoryStore = store;
    }
    /**
     * Get memory store reference
     */
    getMemoryStore() {
        return this._memoryStore;
    }
    /**
     * Ensure storage directory exists
     */
    ensureStorageDir() {
        if (!fs.existsSync(this.config.storageDir)) {
            fs.mkdirSync(this.config.storageDir, { recursive: true });
        }
    }
    /**
     * Calculate file hash
     */
    hashFile(data) {
        return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
    }
    /**
     * Detect image format from buffer
     */
    detectFormat(data) {
        // PNG signature
        if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
            return 'png';
        }
        // JPEG signature
        if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
            return 'jpeg';
        }
        // GIF signature
        if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
            return 'gif';
        }
        // WebP signature
        if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
            return 'webp';
        }
        return null;
    }
    /**
     * Store an image from file path
     */
    async storeImage(filePath, options = {}) {
        if (!this.config.enabled) {
            return null;
        }
        // Read file
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const data = fs.readFileSync(filePath);
        return this.storeImageBuffer(data, {
            ...options,
            originalPath: filePath
        });
    }
    /**
     * Store an image from buffer
     */
    async storeImageBuffer(data, options = {}) {
        if (!this.config.enabled) {
            return null;
        }
        // Validate size
        if (data.length > this.config.maxImageSize) {
            throw new Error(`Image exceeds max size: ${data.length} > ${this.config.maxImageSize}`);
        }
        // Detect format
        const format = this.detectFormat(data);
        if (!format) {
            throw new Error('Unsupported image format');
        }
        // Generate hash and ID
        const hash = this.hashFile(data);
        const id = `img_${hash}_${Date.now()}`;
        // Check for duplicate
        const existing = Array.from(this.memories.values()).find(m => m.hash === hash);
        if (existing) {
            return existing;
        }
        // Ensure storage directory
        this.ensureStorageDir();
        // Save file
        const fileName = `${id}.${format}`;
        const storagePath = path.join(this.config.storageDir, fileName);
        fs.writeFileSync(storagePath, data);
        // Create memory entry
        const memory = {
            id,
            type: options.type || 'image',
            format,
            filePath: storagePath,
            hash,
            description: options.description || '',
            tags: options.tags || [],
            createdAt: new Date(),
            importance: options.importance || 0.5,
            relatedMemories: []
        };
        this.memories.set(id, memory);
        return memory;
    }
    /**
     * Analyze an image (stub - requires Claude API integration)
     */
    async analyzeImage(imageId, stance) {
        const memory = this.memories.get(imageId);
        if (!memory) {
            return null;
        }
        // TODO: Integrate with Claude's vision API
        // This would involve:
        // 1. Converting image to base64
        // 2. Sending to Claude with vision capability
        // 3. Parsing response for objects, text, mood, etc.
        // For now, return a placeholder analysis
        const analysis = {
            summary: `[Stub] Image analysis for ${memory.type}`,
            objects: [],
            text: [],
            colors: [],
            mood: undefined,
            stanceRelevance: stance ? `Current frame: ${stance.frame}` : undefined
        };
        memory.analysis = analysis;
        return analysis;
    }
    /**
     * Generate description prompt for Claude vision
     */
    generateAnalysisPrompt(stance) {
        const basePrompt = `Analyze this image and provide:
1. A brief summary (1-2 sentences)
2. Key objects or elements visible
3. Any text visible (OCR)
4. Dominant colors
5. Overall mood or tone`;
        if (stance) {
            return `${basePrompt}

Additionally, considering my current perspective is ${stance.frame} with a ${stance.selfModel} self-model,
how might this image be relevant or meaningful?`;
        }
        return basePrompt;
    }
    /**
     * Get image as base64 (for API calls)
     */
    getImageBase64(imageId) {
        const memory = this.memories.get(imageId);
        if (!memory || !fs.existsSync(memory.filePath)) {
            return null;
        }
        const data = fs.readFileSync(memory.filePath);
        return data.toString('base64');
    }
    /**
     * Search multi-modal memories
     */
    search(options) {
        let results = Array.from(this.memories.values());
        // Filter by type
        if (options.type) {
            results = results.filter(m => m.type === options.type);
        }
        // Filter by tags
        if (options.tags && options.tags.length > 0) {
            results = results.filter(m => options.tags.some(tag => m.tags.includes(tag)));
        }
        // Filter by importance
        if (options.minImportance !== undefined) {
            results = results.filter(m => m.importance >= options.minImportance);
        }
        // Sort by importance and recency
        results.sort((a, b) => {
            const importanceDiff = b.importance - a.importance;
            if (Math.abs(importanceDiff) > 0.1)
                return importanceDiff;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
        // Apply limit
        if (options.limit) {
            results = results.slice(0, options.limit);
        }
        return results;
    }
    /**
     * Get memory by ID
     */
    getMemory(id) {
        return this.memories.get(id) || null;
    }
    /**
     * Update memory metadata
     */
    updateMemory(id, updates) {
        const memory = this.memories.get(id);
        if (!memory)
            return false;
        // Only allow updating certain fields
        if (updates.description !== undefined)
            memory.description = updates.description;
        if (updates.tags !== undefined)
            memory.tags = updates.tags;
        if (updates.importance !== undefined)
            memory.importance = updates.importance;
        if (updates.analysis !== undefined)
            memory.analysis = updates.analysis;
        if (updates.relatedMemories !== undefined)
            memory.relatedMemories = updates.relatedMemories;
        return true;
    }
    /**
     * Link to text memory
     */
    linkToTextMemory(imageId, textMemoryId) {
        const memory = this.memories.get(imageId);
        if (!memory)
            return false;
        if (!memory.relatedMemories.includes(textMemoryId)) {
            memory.relatedMemories.push(textMemoryId);
        }
        return true;
    }
    /**
     * Delete memory
     */
    deleteMemory(id) {
        const memory = this.memories.get(id);
        if (!memory)
            return false;
        // Delete file
        if (fs.existsSync(memory.filePath)) {
            fs.unlinkSync(memory.filePath);
        }
        this.memories.delete(id);
        return true;
    }
    /**
     * Get all memories
     */
    getAllMemories() {
        return Array.from(this.memories.values());
    }
    /**
     * Get statistics
     */
    getStats() {
        const memories = Array.from(this.memories.values());
        const byType = {};
        let totalSize = 0;
        let analyzed = 0;
        for (const m of memories) {
            byType[m.type] = (byType[m.type] || 0) + 1;
            if (fs.existsSync(m.filePath)) {
                totalSize += fs.statSync(m.filePath).size;
            }
            if (m.analysis)
                analyzed++;
        }
        return {
            totalImages: memories.length,
            byType,
            totalSize,
            analyzed
        };
    }
    /**
     * Clear all memories
     */
    clear() {
        for (const memory of this.memories.values()) {
            if (fs.existsSync(memory.filePath)) {
                fs.unlinkSync(memory.filePath);
            }
        }
        this.memories.clear();
    }
}
// Singleton instance
export const multiModalMemory = new MultiModalMemoryManager();
//# sourceMappingURL=multi-modal.js.map