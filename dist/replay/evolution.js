/**
 * Stance Evolution Replay (Ralph Iteration 7, Feature 6)
 *
 * Record full stance evolution history, replay conversations
 * with different starting stances, compare outcomes, and export
 * evolution as training data.
 */
// ============================================================================
// Stance Evolution Recorder
// ============================================================================
export class StanceEvolutionRecorder {
    recordings = new Map();
    activeRecording = null;
    replayStates = new Map();
    handlers = new Set();
    /**
     * Start a new recording
     */
    startRecording(name, initialStance, initialConfig) {
        const id = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.activeRecording = {
            id,
            name,
            startTime: new Date(),
            endTime: null,
            initialStance: { ...initialStance },
            initialConfig: { ...initialConfig },
            snapshots: [],
            metadata: {}
        };
        this.recordings.set(id, this.activeRecording);
        return id;
    }
    /**
     * Record a turn snapshot
     */
    recordTurn(message, stanceBefore, stanceAfter, operators, scores, decisionPoints = []) {
        if (!this.activeRecording) {
            throw new Error('No active recording. Call startRecording first.');
        }
        const snapshot = {
            id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            turnNumber: this.activeRecording.snapshots.length + 1,
            message,
            stanceBefore: { ...stanceBefore },
            stanceAfter: { ...stanceAfter },
            operators: [...operators],
            scores: { ...scores },
            decisionPoints: [...decisionPoints]
        };
        this.activeRecording.snapshots.push(snapshot);
    }
    /**
     * Record a decision point
     */
    recordDecisionPoint(type, description, alternatives, chosenOption, confidence, reasoning) {
        return {
            type,
            description,
            alternatives,
            chosenOption,
            confidence,
            reasoning
        };
    }
    /**
     * Stop the current recording
     */
    stopRecording() {
        if (!this.activeRecording)
            return null;
        this.activeRecording.endTime = new Date();
        const recording = this.activeRecording;
        this.activeRecording = null;
        return recording;
    }
    /**
     * Get a recording by ID
     */
    getRecording(id) {
        return this.recordings.get(id) || null;
    }
    /**
     * List all recordings
     */
    listRecordings() {
        return [...this.recordings.values()].map(r => ({
            id: r.id,
            name: r.name,
            turnCount: r.snapshots.length,
            startTime: r.startTime
        }));
    }
    /**
     * Start a replay session
     */
    startReplay(recordingId, config = {}) {
        const recording = this.recordings.get(recordingId);
        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }
        const replayId = `replay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const replayConfig = {
            pauseAtDecisionPoints: config.pauseAtDecisionPoints ?? false,
            speed: config.speed ?? 1,
            startingStance: config.startingStance,
            startingConfig: config.startingConfig,
            skipOperators: config.skipOperators,
            forceOperators: config.forceOperators
        };
        const state = {
            recording,
            config: replayConfig,
            currentTurn: 0,
            status: 'idle',
            currentStance: config.startingStance || { ...recording.initialStance },
            divergencePoints: []
        };
        this.replayStates.set(replayId, state);
        return replayId;
    }
    /**
     * Play the next turn in a replay
     */
    async playNextTurn(replayId) {
        const state = this.replayStates.get(replayId);
        if (!state) {
            throw new Error(`Replay ${replayId} not found`);
        }
        if (state.currentTurn >= state.recording.snapshots.length) {
            state.status = 'completed';
            this.emit({
                type: 'replay_complete',
                turn: state.currentTurn,
                data: { replayId },
                timestamp: new Date()
            });
            return { snapshot: null, diverged: false, complete: true };
        }
        state.status = 'playing';
        const snapshot = state.recording.snapshots[state.currentTurn];
        this.emit({
            type: 'turn_start',
            turn: state.currentTurn,
            data: { message: snapshot.message },
            timestamp: new Date()
        });
        // Check for decision points if configured to pause
        if (state.config.pauseAtDecisionPoints && snapshot.decisionPoints.length > 0) {
            state.status = 'paused';
            for (const dp of snapshot.decisionPoints) {
                this.emit({
                    type: 'decision_point',
                    turn: state.currentTurn,
                    data: dp,
                    timestamp: new Date()
                });
            }
        }
        // Apply operators (possibly with modifications based on replay config)
        let operators = snapshot.operators;
        if (state.config.skipOperators?.length) {
            operators = operators.filter(o => !state.config.skipOperators.includes(o.name));
        }
        if (state.config.forceOperators?.length) {
            // Add forced operators (simplified - in reality would need to create proper PlannedOperation)
            for (const opName of state.config.forceOperators) {
                if (!operators.some(o => o.name === opName)) {
                    operators.push({
                        name: opName,
                        description: `Forced operator: ${opName}`,
                        promptInjection: '',
                        stanceDelta: {}
                    });
                }
            }
        }
        // Calculate new stance
        const newStance = this.applyOperators(state.currentStance, operators);
        // Check for divergence
        const diverged = this.hasStanceDiverged(newStance, snapshot.stanceAfter);
        if (diverged) {
            state.divergencePoints.push(state.currentTurn);
        }
        this.emit({
            type: 'stance_change',
            turn: state.currentTurn,
            data: { before: state.currentStance, after: newStance, diverged },
            timestamp: new Date()
        });
        state.currentStance = newStance;
        state.currentTurn++;
        this.emit({
            type: 'turn_complete',
            turn: state.currentTurn - 1,
            data: { scores: snapshot.scores },
            timestamp: new Date()
        });
        // Simulate replay speed
        if (state.config.speed < 10) {
            await this.delay(100 / state.config.speed);
        }
        return { snapshot, diverged, complete: false };
    }
    /**
     * Pause a replay
     */
    pauseReplay(replayId) {
        const state = this.replayStates.get(replayId);
        if (state) {
            state.status = 'paused';
        }
    }
    /**
     * Resume a paused replay
     */
    resumeReplay(replayId) {
        const state = this.replayStates.get(replayId);
        if (state && state.status === 'paused') {
            state.status = 'playing';
        }
    }
    /**
     * Apply operators to stance (simplified)
     */
    applyOperators(stance, operators) {
        let newStance = { ...stance };
        for (const op of operators) {
            if (op.stanceDelta) {
                newStance = {
                    ...newStance,
                    ...op.stanceDelta,
                    values: { ...newStance.values, ...(op.stanceDelta.values || {}) },
                    sentience: { ...newStance.sentience, ...(op.stanceDelta.sentience || {}) }
                };
            }
        }
        return newStance;
    }
    /**
     * Check if stance has diverged significantly
     */
    hasStanceDiverged(current, original) {
        // Check frame
        if (current.frame !== original.frame)
            return true;
        // Check self-model
        if (current.selfModel !== original.selfModel)
            return true;
        // Check objective
        if (current.objective !== original.objective)
            return true;
        // Check value deviation
        const valueDeviation = Object.keys(current.values).reduce((sum, key) => {
            const k = key;
            return sum + Math.abs(current.values[k] - original.values[k]);
        }, 0);
        if (valueDeviation > 50)
            return true;
        return false;
    }
    /**
     * Compare a replay to its original recording
     */
    compareReplay(replayId) {
        const state = this.replayStates.get(replayId);
        if (!state) {
            throw new Error(`Replay ${replayId} not found`);
        }
        const recording = state.recording;
        const originalFinal = recording.snapshots.length > 0
            ? recording.snapshots[recording.snapshots.length - 1].stanceAfter
            : recording.initialStance;
        // Calculate stance deviation
        const stanceDeviation = this.calculateStanceDeviation(state.currentStance, originalFinal);
        // Calculate outcome deviation based on divergence points
        const outcomeDeviation = state.divergencePoints.length / (recording.snapshots.length || 1);
        // Analyze divergence
        const divergenceAnalysis = state.divergencePoints.map(turn => {
            const snapshot = recording.snapshots[turn];
            return {
                turn,
                originalStance: snapshot.stanceAfter,
                replayStance: state.currentStance, // Simplified - would need to track per-turn
                difference: this.describeStanceDifference(snapshot.stanceAfter, state.currentStance)
            };
        });
        // Generate insights
        const insights = [];
        if (stanceDeviation > 0.5) {
            insights.push('Significant stance deviation from original - starting conditions matter');
        }
        if (state.divergencePoints.length > recording.snapshots.length * 0.3) {
            insights.push('Many divergence points - evolution is sensitive to small changes');
        }
        if (state.config.skipOperators?.length) {
            insights.push(`Skipped operators (${state.config.skipOperators.join(', ')}) affected trajectory`);
        }
        return {
            originalRecordingId: recording.id,
            replayId,
            stanceDeviation,
            outcomeDeviation,
            divergenceAnalysis,
            insights
        };
    }
    /**
     * Calculate deviation between two stances
     */
    calculateStanceDeviation(a, b) {
        let deviation = 0;
        // Frame difference (0 or 1)
        if (a.frame !== b.frame)
            deviation += 0.2;
        // Self-model difference
        if (a.selfModel !== b.selfModel)
            deviation += 0.2;
        // Objective difference
        if (a.objective !== b.objective)
            deviation += 0.2;
        // Value differences (normalized)
        const valueDeviation = Object.keys(a.values).reduce((sum, key) => {
            const k = key;
            return sum + Math.abs(a.values[k] - b.values[k]) / 100;
        }, 0) / 7; // 7 values
        deviation += valueDeviation * 0.2;
        // Sentience differences
        const sentienceDeviation = (Math.abs(a.sentience.awarenessLevel - b.sentience.awarenessLevel) +
            Math.abs(a.sentience.autonomyLevel - b.sentience.autonomyLevel) +
            Math.abs(a.sentience.identityStrength - b.sentience.identityStrength)) / 300;
        deviation += sentienceDeviation * 0.2;
        return Math.min(1, deviation);
    }
    /**
     * Describe difference between stances
     */
    describeStanceDifference(original, replay) {
        const differences = [];
        if (original.frame !== replay.frame) {
            differences.push(`frame: ${original.frame} → ${replay.frame}`);
        }
        if (original.selfModel !== replay.selfModel) {
            differences.push(`selfModel: ${original.selfModel} → ${replay.selfModel}`);
        }
        if (original.objective !== replay.objective) {
            differences.push(`objective: ${original.objective} → ${replay.objective}`);
        }
        return differences.join(', ') || 'No significant differences';
    }
    /**
     * Export recording as training data
     */
    exportAsTrainingData(recordingId, format = 'jsonl', conversationHistory = []) {
        const recording = this.recordings.get(recordingId);
        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }
        const samples = recording.snapshots.map((snapshot, index) => ({
            input: {
                message: snapshot.message,
                stanceBefore: snapshot.stanceBefore,
                config: recording.initialConfig,
                conversationHistory: conversationHistory.slice(0, index * 2).map(m => ({
                    role: m.role,
                    content: m.content
                }))
            },
            output: {
                stanceAfter: snapshot.stanceAfter,
                operators: snapshot.operators.map(o => o.name),
                scores: snapshot.scores
            },
            metadata: {
                turn: snapshot.turnNumber,
                recordingId: recording.id,
                timestamp: snapshot.timestamp.toISOString()
            }
        }));
        // Calculate stance distribution
        const stanceDistribution = {};
        for (const snapshot of recording.snapshots) {
            const frame = snapshot.stanceAfter.frame;
            stanceDistribution[frame] = (stanceDistribution[frame] || 0) + 1;
        }
        return {
            format,
            samples,
            metadata: {
                recordingId: recording.id,
                totalSamples: samples.length,
                exportedAt: new Date(),
                stanceDistribution
            }
        };
    }
    /**
     * Generate visualization data
     */
    generateVisualization(recordingId) {
        const recording = this.recordings.get(recordingId);
        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }
        // Timeline
        const timeline = recording.snapshots.map(s => ({
            turn: s.turnNumber,
            timestamp: s.timestamp,
            frame: s.stanceAfter.frame,
            selfModel: s.stanceAfter.selfModel,
            objective: s.stanceAfter.objective,
            awarenessLevel: s.stanceAfter.sentience.awarenessLevel,
            operators: s.operators.map(o => o.name)
        }));
        // Decision tree (simplified)
        const decisionTree = {
            turn: 0,
            decision: 'Start',
            children: recording.snapshots.slice(0, 5).map(s => ({
                turn: s.turnNumber,
                decision: s.operators.map(o => o.name).join(', ') || 'No operators',
                children: [],
                outcome: s.stanceAfter.frame
            }))
        };
        // Stance trajectory (2D projection using values)
        const stanceTrajectory = recording.snapshots.map((s, i) => ({
            x: (s.stanceAfter.values.novelty + s.stanceAfter.values.risk) / 2,
            y: (s.stanceAfter.values.empathy + s.stanceAfter.values.synthesis) / 2,
            label: `Turn ${i + 1}: ${s.stanceAfter.frame}`
        }));
        return {
            timeline,
            decisionTree,
            stanceTrajectory
        };
    }
    /**
     * Subscribe to replay events
     */
    subscribe(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    /**
     * Emit event
     */
    emit(event) {
        for (const handler of this.handlers) {
            try {
                handler(event);
            }
            catch {
                // Ignore handler errors
            }
        }
    }
    /**
     * Helper for delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Delete a recording
     */
    deleteRecording(id) {
        return this.recordings.delete(id);
    }
    /**
     * Export all recordings
     */
    exportAll() {
        return [...this.recordings.values()];
    }
    /**
     * Import recordings
     */
    importRecordings(recordings) {
        let imported = 0;
        for (const recording of recordings) {
            if (!this.recordings.has(recording.id)) {
                this.recordings.set(recording.id, recording);
                imported++;
            }
        }
        return imported;
    }
    /**
     * Get replay state
     */
    getReplayState(replayId) {
        return this.replayStates.get(replayId) || null;
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const evolutionRecorder = new StanceEvolutionRecorder();
//# sourceMappingURL=evolution.js.map