/**
 * Gradual Stance Morphing
 *
 * Smooth transitions between stances with configurable curves,
 * intermediate state generation, and rollback capabilities.
 */
import type { Stance } from '../types/index.js';
export interface MorphConfig {
    duration: number;
    steps: number;
    curve: EasingCurve;
    validateCheckpoints: boolean;
    allowRollback: boolean;
}
export type EasingCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic' | 'elastic' | 'bounce';
export interface MorphTransition {
    id: string;
    source: Stance;
    target: Stance;
    config: MorphConfig;
    intermediateStates: IntermediateState[];
    status: 'pending' | 'in_progress' | 'completed' | 'rolled_back' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    currentStep: number;
    rollbackPoints: RollbackPoint[];
}
export interface IntermediateState {
    step: number;
    progress: number;
    stance: Stance;
    coherence: number;
    validated: boolean;
    validationErrors?: string[];
}
export interface RollbackPoint {
    step: number;
    stance: Stance;
    timestamp: Date;
    canRollback: boolean;
}
export interface MorphProgress {
    transitionId: string;
    currentStep: number;
    totalSteps: number;
    progress: number;
    currentStance: Stance;
    estimatedTimeRemaining: number;
    status: MorphTransition['status'];
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    coherenceCheck: boolean;
    valueRangeCheck: boolean;
}
export declare class GradualMorpher {
    private transitions;
    private onProgressCallbacks;
    private defaultConfig;
    createTransition(source: Stance, target: Stance, config?: Partial<MorphConfig>): MorphTransition;
    private generateIntermediateStates;
    private interpolateStance;
    private lerp;
    private calculateCoherence;
    startTransition(transitionId: string): Promise<void>;
    private validateState;
    rollback(transitionId: string, toStep?: number): Stance | null;
    getProgress(transitionId: string): MorphProgress | null;
    getCurrentStance(transitionId: string): Stance | null;
    getIntermediateStates(transitionId: string): IntermediateState[];
    onProgress(callback: (progress: MorphProgress) => void): () => void;
    private notifyProgress;
    private delay;
    cancelTransition(transitionId: string): boolean;
    getTransition(transitionId: string): MorphTransition | undefined;
    listTransitions(): MorphTransition[];
    previewTransition(source: Stance, target: Stance, config?: Partial<MorphConfig>): IntermediateState[];
    setDefaultConfig(config: Partial<MorphConfig>): void;
    getDefaultConfig(): MorphConfig;
    getVisualFeedback(transitionId: string): VisualFeedback[];
    private coherenceToColor;
    private getStepLabel;
}
export interface VisualFeedback {
    step: number;
    progress: number;
    coherence: number;
    color: string;
    pulseIntensity: number;
    label: string;
}
export declare function createGradualMorpher(config?: Partial<MorphConfig>): GradualMorpher;
//# sourceMappingURL=gradual.d.ts.map