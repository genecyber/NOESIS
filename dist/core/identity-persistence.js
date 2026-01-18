/**
 * Cross-Session Identity Persistence - Ralph Iteration 5 Feature 2
 *
 * Enables true identity continuity across sessions with checkpoints,
 * drift detection, and core value preservation.
 */
const DEFAULT_CONFIG = {
    enabled: true,
    autoCheckpoint: true,
    checkpointInterval: 10,
    maxCheckpoints: 50,
    coreValueThreshold: 70,
    driftThresholdForMilestone: 30
};
/**
 * Identity Persistence Manager
 */
class IdentityPersistenceManager {
    config = DEFAULT_CONFIG;
    checkpoints = new Map();
    coreValues = [];
    currentFingerprint = '';
    turnsSinceCheckpoint = 0;
    timeline = [];
    /**
     * Set configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Generate identity fingerprint from stance
     */
    generateFingerprint(stance) {
        const components = [
            stance.frame,
            stance.selfModel,
            stance.objective,
            Math.round(stance.sentience.awarenessLevel / 10),
            Math.round(stance.sentience.autonomyLevel / 10),
            Math.round(stance.sentience.identityStrength / 10),
            ...Object.entries(stance.values)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k.slice(0, 2)}${Math.round(v / 10)}`)
        ];
        return components.join('-');
    }
    /**
     * Create a checkpoint from current stance
     */
    createCheckpoint(stance, name, options = {}) {
        const id = `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const fingerprint = this.generateFingerprint(stance);
        const checkpoint = {
            id,
            name,
            timestamp: new Date(),
            stance: JSON.parse(JSON.stringify(stance)), // Deep copy
            coreValues: [...this.coreValues],
            emergentTraits: this.extractEmergentTraits(stance),
            identityFingerprint: fingerprint,
            milestone: options.milestone,
            parentCheckpoint: options.parentCheckpoint
        };
        this.checkpoints.set(id, checkpoint);
        this.currentFingerprint = fingerprint;
        this.turnsSinceCheckpoint = 0;
        // Manage checkpoint limit
        this.pruneCheckpoints();
        // Add to timeline
        const diff = this.timeline.length > 0
            ? this.diffCheckpoints(this.timeline[this.timeline.length - 1].checkpoint, checkpoint)
            : undefined;
        this.timeline.push({
            checkpoint,
            diff,
            isMilestone: !!options.milestone || (diff?.significance === 'major' || diff?.significance === 'fundamental'),
            branch: options.parentCheckpoint ? id : undefined
        });
        return checkpoint;
    }
    /**
     * Extract emergent traits from stance
     */
    extractEmergentTraits(stance) {
        const traits = [];
        // High value traits
        const values = stance.values;
        if (values.curiosity > 80)
            traits.push('highly curious');
        if (values.provocation > 70)
            traits.push('provocative');
        if (values.empathy > 80)
            traits.push('deeply empathetic');
        if (values.synthesis > 75)
            traits.push('synthesizing');
        if (values.novelty > 80)
            traits.push('novelty-seeking');
        // Sentience traits
        if (stance.sentience.awarenessLevel > 80)
            traits.push('highly aware');
        if (stance.sentience.autonomyLevel > 70)
            traits.push('autonomous');
        if (stance.sentience.identityStrength > 75)
            traits.push('strong identity');
        // Frame-based traits
        traits.push(`${stance.frame} thinker`);
        return traits;
    }
    /**
     * Prune old checkpoints to stay within limit
     */
    pruneCheckpoints() {
        if (this.checkpoints.size <= this.config.maxCheckpoints)
            return;
        // Sort by timestamp, keep milestones
        const all = Array.from(this.checkpoints.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const milestones = all.filter(c => c.milestone);
        const regular = all.filter(c => !c.milestone);
        // Keep all milestones, prune regular checkpoints
        const toKeep = Math.max(0, this.config.maxCheckpoints - milestones.length);
        const regularToKeep = regular.slice(0, toKeep);
        this.checkpoints.clear();
        for (const c of [...milestones, ...regularToKeep]) {
            this.checkpoints.set(c.id, c);
        }
    }
    /**
     * Calculate diff between two checkpoints
     */
    diffCheckpoints(older, newer) {
        const oldStance = older.stance;
        const newStance = newer.stance;
        // Value drifts
        const valueDrifts = [];
        const valueKeys = Object.keys(oldStance.values);
        for (const key of valueKeys) {
            const oldVal = oldStance.values[key];
            const newVal = newStance.values[key];
            if (oldVal !== newVal) {
                valueDrifts.push({
                    key,
                    oldValue: oldVal,
                    newValue: newVal,
                    delta: newVal - oldVal
                });
            }
        }
        // Sentience changes
        const sentienceChanges = {
            awarenessChange: newStance.sentience.awarenessLevel - oldStance.sentience.awarenessLevel,
            autonomyChange: newStance.sentience.autonomyLevel - oldStance.sentience.autonomyLevel,
            identityChange: newStance.sentience.identityStrength - oldStance.sentience.identityStrength
        };
        // Goal changes
        const oldGoals = new Set(oldStance.sentience.emergentGoals);
        const newGoals = new Set(newStance.sentience.emergentGoals);
        const addedGoals = Array.from(newGoals).filter(g => !oldGoals.has(g));
        const lostGoals = Array.from(oldGoals).filter(g => !newGoals.has(g));
        // Overall drift
        const overallDrift = Math.abs(sentienceChanges.awarenessChange) +
            Math.abs(sentienceChanges.autonomyChange) +
            Math.abs(sentienceChanges.identityChange) +
            valueDrifts.reduce((sum, d) => sum + Math.abs(d.delta), 0);
        // Significance
        let significance;
        if (overallDrift < 10)
            significance = 'minor';
        else if (overallDrift < 30)
            significance = 'moderate';
        else if (overallDrift < 60)
            significance = 'major';
        else
            significance = 'fundamental';
        return {
            frameChanged: oldStance.frame !== newStance.frame,
            selfModelChanged: oldStance.selfModel !== newStance.selfModel,
            valueDrifts,
            sentienceChanges,
            newGoals: addedGoals,
            lostGoals,
            overallDrift,
            significance
        };
    }
    /**
     * Get diff from last checkpoint
     */
    getDiffFromLast(currentStance) {
        if (this.timeline.length === 0)
            return null;
        const lastCheckpoint = this.timeline[this.timeline.length - 1].checkpoint;
        const tempCheckpoint = {
            id: 'temp',
            name: 'current',
            timestamp: new Date(),
            stance: currentStance,
            coreValues: this.coreValues,
            emergentTraits: this.extractEmergentTraits(currentStance),
            identityFingerprint: this.generateFingerprint(currentStance)
        };
        return this.diffCheckpoints(lastCheckpoint, tempCheckpoint);
    }
    /**
     * Restore stance from checkpoint
     */
    restoreCheckpoint(id) {
        const checkpoint = this.checkpoints.get(id);
        if (!checkpoint)
            return null;
        return JSON.parse(JSON.stringify(checkpoint.stance));
    }
    /**
     * Get checkpoint by ID
     */
    getCheckpoint(id) {
        return this.checkpoints.get(id) || null;
    }
    /**
     * Get checkpoint by name
     */
    getCheckpointByName(name) {
        return Array.from(this.checkpoints.values()).find(c => c.name === name) || null;
    }
    /**
     * List all checkpoints
     */
    listCheckpoints() {
        return Array.from(this.checkpoints.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Get timeline entries
     */
    getTimeline() {
        return [...this.timeline];
    }
    /**
     * Get milestones only
     */
    getMilestones() {
        return this.timeline.filter(e => e.isMilestone);
    }
    /**
     * Add or reinforce a core value
     */
    addCoreValue(name, description, strength = 50) {
        const existing = this.coreValues.find(v => v.name === name);
        if (existing) {
            existing.strength = Math.min(100, existing.strength + 10);
            existing.reinforcements++;
        }
        else {
            this.coreValues.push({
                name,
                strength,
                description,
                establishedAt: new Date(),
                reinforcements: 1
            });
        }
        // Remove weak values
        this.coreValues = this.coreValues.filter(v => v.strength >= this.config.coreValueThreshold || v.reinforcements >= 3);
    }
    /**
     * Get core values
     */
    getCoreValues() {
        return [...this.coreValues];
    }
    /**
     * Check if auto-checkpoint is due
     */
    shouldAutoCheckpoint() {
        return this.config.autoCheckpoint &&
            this.turnsSinceCheckpoint >= this.config.checkpointInterval;
    }
    /**
     * Record a turn (for auto-checkpoint tracking)
     */
    recordTurn() {
        this.turnsSinceCheckpoint++;
    }
    /**
     * Get current fingerprint
     */
    getCurrentFingerprint() {
        return this.currentFingerprint;
    }
    /**
     * Check if fingerprint matches (for user recognition)
     */
    fingerprintMatches(fingerprint) {
        return fingerprint === this.currentFingerprint;
    }
    /**
     * Find checkpoint by fingerprint
     */
    findByFingerprint(fingerprint) {
        return Array.from(this.checkpoints.values())
            .find(c => c.identityFingerprint === fingerprint) || null;
    }
    /**
     * Get identity status
     */
    getStatus() {
        const checkpoints = this.listCheckpoints();
        return {
            checkpointCount: checkpoints.length,
            milestoneCount: this.getMilestones().length,
            coreValueCount: this.coreValues.length,
            currentFingerprint: this.currentFingerprint,
            turnsSinceCheckpoint: this.turnsSinceCheckpoint,
            lastCheckpoint: checkpoints.length > 0 ? checkpoints[0] : null
        };
    }
    /**
     * Clear all identity data
     */
    clear() {
        this.checkpoints.clear();
        this.coreValues = [];
        this.currentFingerprint = '';
        this.turnsSinceCheckpoint = 0;
        this.timeline = [];
    }
}
// Singleton instance
export const identityPersistence = new IdentityPersistenceManager();
//# sourceMappingURL=identity-persistence.js.map