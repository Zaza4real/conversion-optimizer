export type EntityType = 'product' | 'collection' | 'theme' | 'global';
export type Severity = 'high' | 'medium' | 'low';
export type Effort = 'low' | 'medium' | 'high';
export type PatchType = 'theme_block' | 'product_metafield' | 'product_field' | 'merchant_instruction';
export interface ImpactEstimate {
    metric: string;
    low: number;
    high: number;
}
export interface ConditionThemeBlockMissing {
    type: 'theme_block_missing';
    block_type: string;
    context: 'product_page' | 'page' | 'global';
}
export interface ConditionProductFieldEmpty {
    type: 'product_field_empty';
    field: 'title' | 'descriptionHtml' | string;
    min_length?: number;
}
export interface ConditionCountBelow {
    type: 'count_below';
    field: 'image_count' | 'bullet_count' | 'word_count';
    threshold: number;
}
export type Condition = ConditionThemeBlockMissing | ConditionProductFieldEmpty | ConditionCountBelow | {
    type: 'product_field_bad';
    field: string;
    reason: string;
} | {
    type: 'copy_quality';
    check: string;
};
export interface CroRule {
    id: string;
    category: string;
    entity_types: EntityType[];
    severity: Severity;
    title: string;
    description: string;
    evaluate: 'rule' | 'score';
    condition: Condition;
    patch_type: PatchType;
    patch_template?: Record<string, unknown>;
    impact_estimate?: ImpactEstimate;
    effort: Effort;
    risk: 'low' | 'medium' | 'high';
}
export declare const CRO_RULES: CroRule[];
export declare function getRulesByCategory(category: string): CroRule[];
export declare function getRuleById(id: string): CroRule | undefined;
