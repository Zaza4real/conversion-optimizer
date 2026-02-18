/**
 * CRO lint rule definitions. Each rule has an id, condition, and patch type.
 * Scanner evaluates conditions against theme + product data and writes to recommendations.
 */

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

export type Condition =
  | ConditionThemeBlockMissing
  | ConditionProductFieldEmpty
  | ConditionCountBelow
  | { type: 'product_field_bad'; field: string; reason: string }
  | { type: 'copy_quality'; check: string };

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

export const CRO_RULES: CroRule[] = [
  {
    id: 'trust_above_fold_guarantee',
    category: 'trust',
    entity_types: ['product', 'global'],
    severity: 'high',
    title: 'Add a clear guarantee above the fold',
    description: 'Product pages with a visible guarantee near the fold convert better.',
    evaluate: 'rule',
    condition: { type: 'theme_block_missing', block_type: 'trust_guarantee', context: 'product_page' },
    patch_type: 'theme_block',
    patch_template: { block: 'trust_guarantee', settings: { heading: 'Our guarantee', body: '{{suggested_copy}}' } },
    impact_estimate: { metric: 'conversion_rate', low: 0.01, high: 0.04 },
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'shipping_above_fold',
    category: 'trust',
    entity_types: ['product', 'global'],
    severity: 'high',
    title: 'Show shipping information above the fold',
    description: 'Clear shipping info reduces cart abandonment.',
    evaluate: 'rule',
    condition: { type: 'theme_block_missing', block_type: 'shipping_returns', context: 'product_page' },
    patch_type: 'theme_block',
    patch_template: { block: 'shipping_returns', settings: {} },
    impact_estimate: { metric: 'conversion_rate', low: 0.005, high: 0.02 },
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'returns_above_fold',
    category: 'trust',
    entity_types: ['product', 'global'],
    severity: 'high',
    title: 'Show returns policy clearly',
    description: 'Visible returns policy builds trust.',
    evaluate: 'rule',
    condition: { type: 'theme_block_missing', block_type: 'returns', context: 'product_page' },
    patch_type: 'theme_block',
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'contact_visible',
    category: 'trust',
    entity_types: ['global'],
    severity: 'medium',
    title: 'Make contact or help easy to find',
    description: 'Header or footer should link to contact or help.',
    evaluate: 'rule',
    condition: { type: 'theme_block_missing', block_type: 'contact', context: 'global' },
    patch_type: 'merchant_instruction',
    effort: 'medium',
    risk: 'low',
  },
  {
    id: 'image_count_low',
    category: 'media',
    entity_types: ['product'],
    severity: 'medium',
    title: 'Add more product images',
    description: 'At least 3 images improve confidence.',
    evaluate: 'rule',
    condition: { type: 'count_below', field: 'image_count', threshold: 3 },
    patch_type: 'merchant_instruction',
    impact_estimate: { metric: 'conversion_rate', low: 0.01, high: 0.03 },
    effort: 'medium',
    risk: 'low',
  },
  {
    id: 'image_alt_missing',
    category: 'media',
    entity_types: ['product'],
    severity: 'low',
    title: 'Add alt text to product images',
    description: 'Alt text helps accessibility and SEO.',
    evaluate: 'rule',
    condition: { type: 'product_field_bad', field: 'images_alt', reason: 'missing_alt' },
    patch_type: 'merchant_instruction',
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'no_benefit_bullets',
    category: 'copy',
    entity_types: ['product'],
    severity: 'high',
    title: 'Add benefit bullets to the description',
    description: 'Scannable bullets improve clarity and conversion.',
    evaluate: 'rule',
    condition: { type: 'count_below', field: 'bullet_count', threshold: 2 },
    patch_type: 'product_metafield',
    impact_estimate: { metric: 'conversion_rate', low: 0.02, high: 0.05 },
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'copy_too_short',
    category: 'copy',
    entity_types: ['product'],
    severity: 'medium',
    title: 'Expand product description',
    description: 'Descriptions under 100 words often underperform.',
    evaluate: 'rule',
    condition: { type: 'count_below', field: 'word_count', threshold: 100 },
    patch_type: 'product_field',
    effort: 'medium',
    risk: 'low',
  },
  {
    id: 'compare_at_sanity',
    category: 'pricing',
    entity_types: ['product'],
    severity: 'medium',
    title: 'Fix compare-at price',
    description: 'Compare-at should be higher than price when showing a discount.',
    evaluate: 'rule',
    condition: { type: 'product_field_bad', field: 'compare_at_price', reason: 'compare_at_lte_price' },
    patch_type: 'merchant_instruction',
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'default_variant_missing',
    category: 'variant_ux',
    entity_types: ['product'],
    severity: 'medium',
    title: 'Set a default variant',
    description: 'No default selection can confuse visitors.',
    evaluate: 'rule',
    condition: { type: 'product_field_bad', field: 'variant_default', reason: 'no_default' },
    patch_type: 'merchant_instruction',
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'faq_missing',
    category: 'copy',
    entity_types: ['product'],
    severity: 'medium',
    title: 'Add an FAQ block',
    description: 'FAQ addresses objections and can improve conversion.',
    evaluate: 'rule',
    condition: { type: 'theme_block_missing', block_type: 'faq', context: 'product_page' },
    patch_type: 'theme_block',
    impact_estimate: { metric: 'conversion_rate', low: 0.005, high: 0.02 },
    effort: 'low',
    risk: 'low',
  },
  {
    id: 'urgency_stock_missing',
    category: 'trust',
    entity_types: ['product'],
    severity: 'low',
    title: 'Consider urgency or stock messaging',
    description: 'Subtle stock or shipping urgency can help when accurate.',
    evaluate: 'rule',
    condition: { type: 'theme_block_missing', block_type: 'urgency_stock', context: 'product_page' },
    patch_type: 'theme_block',
    effort: 'low',
    risk: 'medium',
  },
  // Add more rules up to 30+; above is a representative set.
];

export function getRulesByCategory(category: string): CroRule[] {
  return CRO_RULES.filter((r) => r.category === category);
}

export function getRuleById(id: string): CroRule | undefined {
  return CRO_RULES.find((r) => r.id === id);
}
