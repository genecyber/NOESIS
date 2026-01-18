/**
 * Operator Registry - Base definitions and registry for transformation operators
 */
import { OperatorName, OperatorDefinition } from '../types/index.js';
/**
 * Registry of all transformation operators
 */
export declare class OperatorRegistry {
    private operators;
    register(operator: OperatorDefinition): void;
    get(name: OperatorName): OperatorDefinition | undefined;
    getAll(): OperatorDefinition[];
    has(name: OperatorName): boolean;
}
declare const globalRegistry: OperatorRegistry;
/**
 * Get an operator from the global registry
 */
export declare function getOperator(name: OperatorName): OperatorDefinition | undefined;
/**
 * Get the global operator registry
 */
export declare function getRegistry(): OperatorRegistry;
export { globalRegistry };
//# sourceMappingURL=base.d.ts.map