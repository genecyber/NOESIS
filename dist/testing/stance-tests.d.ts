/**
 * Stance Testing Framework
 *
 * Unit tests, regression tests, and coherence assertions for
 * stance evolution with CI/CD integration support.
 */
import type { Stance } from '../types/index.js';
export interface StanceTest {
    id: string;
    name: string;
    description: string;
    type: TestType;
    setup?: TestSetup;
    assertions: StanceAssertion[];
    tags: string[];
    timeout: number;
}
export type TestType = 'unit' | 'regression' | 'coherence' | 'evolution' | 'integration';
export interface TestSetup {
    initialStance?: Partial<Stance>;
    operations?: TestOperation[];
    fixtures?: Record<string, unknown>;
}
export interface TestOperation {
    type: string;
    params: Record<string, unknown>;
}
export interface StanceAssertion {
    field: string;
    operator: AssertionOperator;
    expected: unknown;
    message?: string;
    tolerance?: number;
}
export type AssertionOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'between' | 'contains' | 'matches' | 'isType' | 'isCoherent' | 'hasDrifted' | 'isWithinBudget';
export interface TestResult {
    testId: string;
    passed: boolean;
    duration: number;
    assertions: AssertionResult[];
    error?: string;
    timestamp: Date;
}
export interface AssertionResult {
    assertion: StanceAssertion;
    passed: boolean;
    actual: unknown;
    message?: string;
}
export interface TestSuite {
    id: string;
    name: string;
    tests: StanceTest[];
    setup?: TestSetup;
    teardown?: () => void;
}
export interface TestReport {
    suiteId: string;
    suiteName: string;
    results: TestResult[];
    summary: TestSummary;
    coverage?: CoverageReport;
    timestamp: Date;
}
export interface TestSummary {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    passRate: number;
}
export interface CoverageReport {
    fieldsTestedthe: string[];
    fieldsCovered: number;
    totalFields: number;
    coveragePercent: number;
    uncoveredFields: string[];
}
export interface MockStance {
    generate(overrides?: Partial<Stance>): Stance;
    random(): Stance;
    fromTemplate(template: string): Stance;
    withCoherence(level: number): Stance;
    withDrift(amount: number, from: Stance): Stance;
}
export declare class StanceTestRunner {
    private suites;
    private results;
    private mockStance;
    constructor();
    registerSuite(suite: TestSuite): void;
    runSuite(suiteId: string): Promise<TestReport>;
    runTest(test: StanceTest, suiteSetup?: TestSetup): Promise<TestResult>;
    private buildStance;
    private applyOperation;
    private evaluateAssertion;
    private getFieldValue;
    private deepEquals;
    private checkCoherence;
    private calculateSummary;
    private calculateCoverage;
    getMock(): MockStanceGenerator;
    getReport(suiteId: string): TestReport | undefined;
    getAllReports(): TestReport[];
    generateJUnitXml(report: TestReport): string;
    private escapeXml;
}
export declare class MockStanceGenerator implements MockStance {
    generate(overrides?: Partial<Stance>): Stance;
    random(): Stance;
    fromTemplate(template: string): Stance;
    withCoherence(level: number): Stance;
    withDrift(amount: number, from: Stance): Stance;
}
export declare function assertEquals(field: string, expected: unknown, message?: string): StanceAssertion;
export declare function assertGreaterThan(field: string, expected: number, message?: string): StanceAssertion;
export declare function assertLessThan(field: string, expected: number, message?: string): StanceAssertion;
export declare function assertBetween(field: string, min: number, max: number, message?: string): StanceAssertion;
export declare function assertCoherent(minCoherence: number, message?: string): StanceAssertion;
export declare function assertWithinBudget(budget: number, message?: string): StanceAssertion;
export declare function createTestRunner(): StanceTestRunner;
export declare function createMockStance(): MockStanceGenerator;
//# sourceMappingURL=stance-tests.d.ts.map