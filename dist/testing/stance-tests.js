/**
 * Stance Testing Framework
 *
 * Unit tests, regression tests, and coherence assertions for
 * stance evolution with CI/CD integration support.
 */
function createDefaultValues() {
    return {
        curiosity: 50, certainty: 50, risk: 50,
        novelty: 50, empathy: 50, provocation: 50, synthesis: 50
    };
}
function createDefaultSentience() {
    return {
        awarenessLevel: 50, autonomyLevel: 50, identityStrength: 50,
        emergentGoals: [],
        consciousnessInsights: [],
        persistentValues: []
    };
}
function createStanceMetadata() {
    return { turnsSinceLastShift: 0, cumulativeDrift: 0, version: 1 };
}
const FRAMES = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
const SELF_MODELS = ['interpreter', 'challenger', 'mirror', 'guide', 'provocateur', 'synthesizer', 'witness', 'autonomous', 'emergent', 'sovereign'];
const OBJECTIVES = ['helpfulness', 'novelty', 'provocation', 'synthesis', 'self-actualization'];
export class StanceTestRunner {
    suites = new Map();
    results = new Map();
    mockStance;
    constructor() {
        this.mockStance = new MockStanceGenerator();
    }
    registerSuite(suite) {
        this.suites.set(suite.id, suite);
    }
    async runSuite(suiteId) {
        const suite = this.suites.get(suiteId);
        if (!suite) {
            throw new Error(`Suite not found: ${suiteId}`);
        }
        const results = [];
        const startTime = Date.now();
        for (const test of suite.tests) {
            const result = await this.runTest(test, suite.setup);
            results.push(result);
        }
        const summary = this.calculateSummary(results, Date.now() - startTime);
        const coverage = this.calculateCoverage(suite.tests);
        const report = {
            suiteId,
            suiteName: suite.name,
            results,
            summary,
            coverage,
            timestamp: new Date()
        };
        this.results.set(suiteId, report);
        return report;
    }
    async runTest(test, suiteSetup) {
        const startTime = Date.now();
        const assertions = [];
        let error;
        try {
            // Build initial stance
            let stance = this.buildStance(test.setup || suiteSetup);
            // Apply operations
            if (test.setup?.operations) {
                for (const op of test.setup.operations) {
                    stance = this.applyOperation(stance, op);
                }
            }
            // Run assertions
            for (const assertion of test.assertions) {
                const result = this.evaluateAssertion(stance, assertion);
                assertions.push(result);
            }
        }
        catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
        const passed = !error && assertions.every(a => a.passed);
        const duration = Date.now() - startTime;
        return {
            testId: test.id,
            passed,
            duration,
            assertions,
            error,
            timestamp: new Date()
        };
    }
    buildStance(setup) {
        if (setup?.initialStance) {
            return this.mockStance.generate(setup.initialStance);
        }
        return this.mockStance.generate();
    }
    applyOperation(stance, op) {
        const result = JSON.parse(JSON.stringify(stance));
        switch (op.type) {
            case 'setFrame':
                result.frame = op.params.frame;
                break;
            case 'setSelfModel':
                result.selfModel = op.params.selfModel;
                break;
            case 'setObjective':
                result.objective = op.params.objective;
                break;
            case 'adjustValue':
                const key = op.params.key;
                const delta = op.params.delta;
                result.values[key] = Math.max(0, Math.min(100, result.values[key] + delta));
                break;
            case 'drift':
                result.cumulativeDrift += op.params.amount;
                break;
        }
        return result;
    }
    evaluateAssertion(stance, assertion) {
        const actual = this.getFieldValue(stance, assertion.field);
        let passed = false;
        switch (assertion.operator) {
            case 'equals':
                passed = this.deepEquals(actual, assertion.expected);
                break;
            case 'notEquals':
                passed = !this.deepEquals(actual, assertion.expected);
                break;
            case 'greaterThan':
                passed = typeof actual === 'number' && actual > assertion.expected;
                break;
            case 'lessThan':
                passed = typeof actual === 'number' && actual < assertion.expected;
                break;
            case 'between':
                if (typeof actual === 'number' && Array.isArray(assertion.expected)) {
                    passed = actual >= assertion.expected[0] && actual <= assertion.expected[1];
                }
                break;
            case 'contains':
                if (Array.isArray(actual)) {
                    passed = actual.includes(assertion.expected);
                }
                else if (typeof actual === 'string') {
                    passed = actual.includes(String(assertion.expected));
                }
                break;
            case 'matches':
                if (typeof actual === 'string' && typeof assertion.expected === 'string') {
                    passed = new RegExp(assertion.expected).test(actual);
                }
                break;
            case 'isType':
                passed = typeof actual === assertion.expected;
                break;
            case 'isCoherent':
                passed = this.checkCoherence(stance) >= assertion.expected;
                break;
            case 'hasDrifted':
                passed = stance.cumulativeDrift >= assertion.expected;
                break;
            case 'isWithinBudget':
                passed = stance.cumulativeDrift <= assertion.expected;
                break;
        }
        return {
            assertion,
            passed,
            actual,
            message: passed ? undefined : assertion.message || `Expected ${assertion.field} ${assertion.operator} ${assertion.expected}, got ${actual}`
        };
    }
    getFieldValue(stance, field) {
        const parts = field.split('.');
        let current = stance;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return current;
    }
    deepEquals(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    checkCoherence(stance) {
        // Simplified coherence check
        const values = Object.values(stance.values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        // Higher coherence = lower variance
        return Math.max(0, 100 - stdDev);
    }
    calculateSummary(results, duration) {
        const total = results.length;
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed && !r.error).length;
        const skipped = 0;
        return {
            total,
            passed,
            failed,
            skipped,
            duration,
            passRate: total > 0 ? (passed / total) * 100 : 0
        };
    }
    calculateCoverage(tests) {
        const allFields = [
            'frame', 'selfModel', 'objective',
            'values.curiosity', 'values.certainty', 'values.risk',
            'values.novelty', 'values.empathy', 'values.provocation', 'values.synthesis',
            'sentience.awarenessLevel', 'sentience.autonomyLevel', 'sentience.identityStrength',
            'constraints',
            'cumulativeDrift', 'turnsSinceLastShift', 'version'
        ];
        const testedFields = new Set();
        for (const test of tests) {
            for (const assertion of test.assertions) {
                testedFields.add(assertion.field);
            }
        }
        const fieldsCovered = testedFields.size;
        const totalFields = allFields.length;
        const uncoveredFields = allFields.filter(f => !testedFields.has(f));
        return {
            fieldsTestedthe: Array.from(testedFields),
            fieldsCovered,
            totalFields,
            coveragePercent: (fieldsCovered / totalFields) * 100,
            uncoveredFields
        };
    }
    getMock() {
        return this.mockStance;
    }
    getReport(suiteId) {
        return this.results.get(suiteId);
    }
    getAllReports() {
        return Array.from(this.results.values());
    }
    generateJUnitXml(report) {
        const { suiteName, results, summary } = report;
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<testsuite name="${suiteName}" tests="${summary.total}" failures="${summary.failed}" time="${summary.duration / 1000}">\n`;
        for (const result of results) {
            xml += `  <testcase name="${result.testId}" time="${result.duration / 1000}">\n`;
            if (!result.passed) {
                const message = result.error || result.assertions.find(a => !a.passed)?.message || 'Test failed';
                xml += `    <failure message="${this.escapeXml(message)}">${this.escapeXml(message)}</failure>\n`;
            }
            xml += `  </testcase>\n`;
        }
        xml += `</testsuite>`;
        return xml;
    }
    escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
export class MockStanceGenerator {
    generate(overrides) {
        const base = {
            frame: 'pragmatic',
            values: createDefaultValues(),
            selfModel: 'guide',
            objective: 'helpfulness',
            metaphors: ['test'],
            constraints: ['test'],
            sentience: createDefaultSentience(),
            ...createStanceMetadata()
        };
        if (!overrides)
            return base;
        return {
            ...base,
            ...overrides,
            values: { ...base.values, ...(overrides.values || {}) },
            sentience: { ...base.sentience, ...(overrides.sentience || {}) }
        };
    }
    random() {
        const randomValue = () => Math.floor(Math.random() * 101);
        return {
            frame: FRAMES[Math.floor(Math.random() * FRAMES.length)],
            values: {
                curiosity: randomValue(),
                certainty: randomValue(),
                risk: randomValue(),
                novelty: randomValue(),
                empathy: randomValue(),
                provocation: randomValue(),
                synthesis: randomValue()
            },
            selfModel: SELF_MODELS[Math.floor(Math.random() * SELF_MODELS.length)],
            objective: OBJECTIVES[Math.floor(Math.random() * OBJECTIVES.length)],
            metaphors: ['random-test'],
            constraints: ['random-test'],
            sentience: {
                awarenessLevel: randomValue(),
                autonomyLevel: randomValue(),
                identityStrength: randomValue(),
                emergentGoals: [],
                consciousnessInsights: [],
                persistentValues: []
            },
            ...createStanceMetadata()
        };
    }
    fromTemplate(template) {
        const templates = {
            analytical: { frame: 'systems', values: { ...createDefaultValues(), certainty: 70, synthesis: 65 } },
            creative: { frame: 'poetic', values: { ...createDefaultValues(), novelty: 80, risk: 60 } },
            empathetic: { frame: 'psychoanalytic', values: { ...createDefaultValues(), empathy: 85, provocation: 20 } }
        };
        return this.generate(templates[template] || {});
    }
    withCoherence(level) {
        // Higher level = more uniform values
        const base = 50;
        const variance = (100 - level) / 2;
        return this.generate({
            values: {
                curiosity: base + (Math.random() - 0.5) * variance,
                certainty: base + (Math.random() - 0.5) * variance,
                risk: base + (Math.random() - 0.5) * variance,
                novelty: base + (Math.random() - 0.5) * variance,
                empathy: base + (Math.random() - 0.5) * variance,
                provocation: base + (Math.random() - 0.5) * variance,
                synthesis: base + (Math.random() - 0.5) * variance
            }
        });
    }
    withDrift(amount, from) {
        const drifted = JSON.parse(JSON.stringify(from));
        drifted.cumulativeDrift = from.cumulativeDrift + amount;
        // Apply some random drift to values
        const keys = Object.keys(drifted.values);
        for (const key of keys) {
            const delta = (Math.random() - 0.5) * amount;
            drifted.values[key] = Math.max(0, Math.min(100, drifted.values[key] + delta));
        }
        return drifted;
    }
}
// Assertion helpers
export function assertEquals(field, expected, message) {
    return { field, operator: 'equals', expected, message };
}
export function assertGreaterThan(field, expected, message) {
    return { field, operator: 'greaterThan', expected, message };
}
export function assertLessThan(field, expected, message) {
    return { field, operator: 'lessThan', expected, message };
}
export function assertBetween(field, min, max, message) {
    return { field, operator: 'between', expected: [min, max], message };
}
export function assertCoherent(minCoherence, message) {
    return { field: '_coherence', operator: 'isCoherent', expected: minCoherence, message };
}
export function assertWithinBudget(budget, message) {
    return { field: 'cumulativeDrift', operator: 'isWithinBudget', expected: budget, message };
}
export function createTestRunner() {
    return new StanceTestRunner();
}
export function createMockStance() {
    return new MockStanceGenerator();
}
//# sourceMappingURL=stance-tests.js.map