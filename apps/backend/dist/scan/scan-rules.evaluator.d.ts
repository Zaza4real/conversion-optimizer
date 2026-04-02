import { CroRule, Condition } from '../cro-rules/rule-registry';
import type { ProductNode } from '../shopify/shopify-api.service';
export interface ThemeContext {
    hasBlock: (blockType: string, context: string) => boolean;
}
export interface ScanContext {
    products: ProductNode[];
    theme: ThemeContext;
}
export declare function evaluateConditionForProduct(condition: Condition, product: ProductNode): boolean;
export declare function evaluateConditionForTheme(condition: Condition, theme: ThemeContext): boolean;
export declare function priorityScore(rule: CroRule, impactMid: number): number;
export declare function getImpactMid(rule: CroRule): number;
export declare function runProductRules(products: ProductNode[]): Array<{
    rule: CroRule;
    entityType: string;
    entityId: string;
    rationale: string;
    patchPayload: Record<string, unknown> | null;
}>;
export declare function runGlobalRules(theme: ThemeContext): Array<{
    rule: CroRule;
    entityType: string;
    entityId: string;
    rationale: string;
    patchPayload: Record<string, unknown> | null;
}>;
