import {
  CRO_RULES,
  CroRule,
  Condition,
  ConditionCountBelow,
  ConditionProductFieldEmpty,
  ConditionThemeBlockMissing,
} from '../cro-rules/rule-registry';
import type { ProductNode } from '../shopify/shopify-api.service';

export interface ThemeContext {
  /** We cannot read theme Liquid; assume our blocks are missing unless we have metafield override */
  hasBlock: (blockType: string, context: string) => boolean;
}

export interface ScanContext {
  products: ProductNode[];
  theme: ThemeContext;
}

function wordCount(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(/\s+/).length : 0;
}

function bulletCount(html: string): number {
  const fragment = html.replace(/<br\s*\/?>/gi, '\n');
  const lines = fragment.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const bulletLike = lines.filter((line) => /^[\-\*•]\s/.test(line) || /^<\s*li\s*>/i.test(line));
  return bulletLike.length;
}

export function evaluateConditionForProduct(condition: Condition, product: ProductNode): boolean {
  switch (condition.type) {
    case 'count_below': {
      const c = condition as ConditionCountBelow;
      if (c.field === 'image_count') {
        const count = product.images?.edges?.length ?? 0;
        return count < c.threshold;
      }
      if (c.field === 'bullet_count') {
        const count = bulletCount(product.descriptionHtml || '');
        return count < c.threshold;
      }
      if (c.field === 'word_count') {
        const count = wordCount(product.descriptionHtml || '');
        return count < c.threshold;
      }
      return false;
    }
    case 'product_field_empty': {
      const c = condition as ConditionProductFieldEmpty;
      if (c.field === 'title') return !product.title?.trim();
      if (c.field === 'descriptionHtml') {
        const min = c.min_length ?? 10;
        return !(product.descriptionHtml?.replace(/<[^>]+>/g, '').trim().length >= min);
      }
      return false;
    }
    case 'product_field_bad': {
      const c = condition as { type: 'product_field_bad'; field: string; reason: string };
      if (c.field === 'compare_at_price' && c.reason === 'compare_at_lte_price') {
        const variants = product.variants?.edges ?? [];
        return variants.some((v) => {
          const price = parseFloat(v.node.price);
          const compare = v.node.compareAtPrice ? parseFloat(v.node.compareAtPrice) : null;
          return compare != null && compare <= price;
        });
      }
      if (c.field === 'images_alt' && c.reason === 'missing_alt') {
        const images = product.images?.edges ?? [];
        return images.some((img) => !img.node.altText?.trim());
      }
      if (c.field === 'variant_default' && c.reason === 'no_default') {
        const variants = product.variants?.edges ?? [];
        return variants.length > 1 && !product.options?.some((o) => o.values?.length);
      }
      return false;
    }
    default:
      return false;
  }
}

export function evaluateConditionForTheme(condition: Condition, theme: ThemeContext): boolean {
  if (condition.type === 'theme_block_missing') {
    const c = condition as ConditionThemeBlockMissing;
    return !theme.hasBlock(c.block_type, c.context);
  }
  return false;
}

export function priorityScore(rule: CroRule, impactMid: number): number {
  const effortMult = rule.effort === 'low' ? 1 : rule.effort === 'medium' ? 0.7 : 0.4;
  const riskPenalty = rule.risk === 'low' ? 0 : rule.risk === 'medium' ? 0.2 : 0.5;
  const confidence = rule.severity === 'high' ? 0.9 : rule.severity === 'medium' ? 0.7 : 0.5;
  return confidence * (impactMid || 0.02) * effortMult * (1 - riskPenalty);
}

export function getImpactMid(rule: CroRule): number {
  const est = rule.impact_estimate;
  if (est?.low != null || est?.high != null) return ((est.low ?? 0) + (est.high ?? 0)) / 2;
  return 0.02;
}

export function runProductRules(products: ProductNode[]): Array<{ rule: CroRule; entityType: string; entityId: string; rationale: string; patchPayload: Record<string, unknown> | null }> {
  const out: Array<{ rule: CroRule; entityType: string; entityId: string; rationale: string; patchPayload: Record<string, unknown> | null }> = [];
  for (const rule of CRO_RULES) {
    if (!rule.entity_types.includes('product')) continue;
    for (const product of products) {
      const matches = evaluateConditionForProduct(rule.condition, product);
      if (!matches) continue;
      const rationale = rule.description;
      let patchPayload: Record<string, unknown> | null = null;
      if (rule.patch_type === 'theme_block' && rule.patch_template) {
        const blockType = rule.condition.type === 'theme_block_missing' ? (rule.condition as ConditionThemeBlockMissing).block_type : '';
        patchPayload = { type: 'theme_block', target: 'product_page', block_type: blockType, settings: (rule.patch_template as Record<string, unknown>).settings ?? {} };
      } else if (rule.patch_type === 'product_metafield') {
        patchPayload = { type: 'product_metafield', product_id: product.id, namespace: 'conversion_optimizer', key: 'benefit_bullets', value_type: 'list.single_line_text_field', value: [] };
      } else if (rule.patch_type === 'product_field') {
        patchPayload = { type: 'product_field', product_id: product.id, field: 'descriptionHtml', value: '' };
      }
      out.push({ rule, entityType: 'product', entityId: product.id, rationale, patchPayload });
    }
  }
  return out;
}

export function runGlobalRules(theme: ThemeContext): Array<{ rule: CroRule; entityType: string; entityId: string; rationale: string; patchPayload: Record<string, unknown> | null }> {
  const out: Array<{ rule: CroRule; entityType: string; entityId: string; rationale: string; patchPayload: Record<string, unknown> | null }> = [];
  for (const rule of CRO_RULES) {
    if (!rule.entity_types.includes('global')) continue;
    if (rule.condition.type !== 'theme_block_missing') continue;
    const matches = evaluateConditionForTheme(rule.condition, theme);
    if (!matches) continue;
    const rationale = rule.description;
    const c = rule.condition as ConditionThemeBlockMissing;
    const patchPayload: Record<string, unknown> = {
      type: 'theme_block',
      target: c.context,
      block_type: c.block_type,
      settings: (rule.patch_template as Record<string, unknown>)?.settings ?? {},
      placement_hint: 'above_add_to_cart',
    };
    out.push({ rule, entityType: 'global', entityId: 'theme', rationale, patchPayload });
  }
  return out;
}
