"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateConditionForProduct = evaluateConditionForProduct;
exports.evaluateConditionForTheme = evaluateConditionForTheme;
exports.priorityScore = priorityScore;
exports.getImpactMid = getImpactMid;
exports.runProductRules = runProductRules;
exports.runGlobalRules = runGlobalRules;
const rule_registry_1 = require("../cro-rules/rule-registry");
function productIdTail(gid) {
    const m = String(gid || '').match(/(\d+)$/);
    return m ? m[1] : gid;
}
function themeContextLabel(context) {
    if (context === 'product_page')
        return 'Product page template';
    if (context === 'global')
        return 'Store-wide theme';
    return 'Theme pages';
}
function wordCount(html) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(/\s+/).length : 0;
}
function bulletCount(html) {
    const fragment = html.replace(/<br\s*\/?>/gi, '\n');
    const lines = fragment.split(/\n/).map((s) => s.trim()).filter(Boolean);
    const bulletLike = lines.filter((line) => /^[-*•]\s/.test(line) || /^<\s*li\s*>/i.test(line));
    return bulletLike.length;
}
function evaluateConditionForProduct(condition, product) {
    switch (condition.type) {
        case 'count_below': {
            const c = condition;
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
            const c = condition;
            if (c.field === 'title')
                return !product.title?.trim();
            if (c.field === 'descriptionHtml') {
                const min = c.min_length ?? 10;
                return !(product.descriptionHtml?.replace(/<[^>]+>/g, '').trim().length >= min);
            }
            return false;
        }
        case 'product_field_bad': {
            const c = condition;
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
function evaluateConditionForTheme(condition, theme) {
    if (condition.type === 'theme_block_missing') {
        const c = condition;
        return !theme.hasBlock(c.block_type, c.context);
    }
    return false;
}
function priorityScore(rule, impactMid) {
    const effortMult = rule.effort === 'low' ? 1 : rule.effort === 'medium' ? 0.7 : 0.4;
    const riskPenalty = rule.risk === 'low' ? 0 : rule.risk === 'medium' ? 0.2 : 0.5;
    const confidence = rule.severity === 'high' ? 0.9 : rule.severity === 'medium' ? 0.7 : 0.5;
    return confidence * (impactMid || 0.02) * effortMult * (1 - riskPenalty);
}
function getImpactMid(rule) {
    const est = rule.impact_estimate;
    if (est?.low != null || est?.high != null)
        return ((est.low ?? 0) + (est.high ?? 0)) / 2;
    return 0.02;
}
function runProductRules(products) {
    const out = [];
    for (const rule of rule_registry_1.CRO_RULES) {
        if (!rule.entity_types.includes('product'))
            continue;
        for (const product of products) {
            const matches = evaluateConditionForProduct(rule.condition, product);
            if (!matches)
                continue;
            const rationale = rule.description;
            let patchPayload = null;
            const condition = rule.condition;
            const imageCount = product.images?.edges?.length ?? 0;
            const words = wordCount(product.descriptionHtml || '');
            const bullets = bulletCount(product.descriptionHtml || '');
            const badCompareAt = (product.variants?.edges ?? []).filter((v) => {
                const price = parseFloat(v.node.price);
                const compare = v.node.compareAtPrice ? parseFloat(v.node.compareAtPrice) : null;
                return compare != null && compare <= price;
            }).length;
            const missingAlt = (product.images?.edges ?? []).filter((img) => !img.node.altText?.trim()).length;
            let issueDetail = 'Needs improvement based on this rule.';
            if (condition.type === 'count_below' && condition.field === 'image_count') {
                issueDetail = `This product has ${imageCount} image(s); recommendation is at least ${condition.threshold}.`;
            }
            else if (condition.type === 'count_below' && condition.field === 'bullet_count') {
                issueDetail = `Description has ${bullets} bullet point(s); recommendation is at least ${condition.threshold}.`;
            }
            else if (condition.type === 'count_below' && condition.field === 'word_count') {
                issueDetail = `Description has about ${words} words; recommendation is at least ${condition.threshold}.`;
            }
            else if (condition.type === 'product_field_bad' && condition.field === 'compare_at_price') {
                issueDetail = `${badCompareAt} variant(s) have compare-at price lower than or equal to the sale price.`;
            }
            else if (condition.type === 'product_field_bad' && condition.field === 'images_alt') {
                issueDetail = `${missingAlt} image(s) are missing alt text.`;
            }
            else if (condition.type === 'product_field_bad' && condition.field === 'variant_default') {
                issueDetail = 'Variant selection may not have a clear default state.';
            }
            else if (condition.type === 'theme_block_missing') {
                issueDetail = `${themeContextLabel(condition.context)} is missing block: ${condition.block_type}.`;
            }
            const targetLabel = `${product.title || 'Untitled product'} (${product.handle ? `/products/${product.handle}` : `ID ${productIdTail(product.id)}`})`;
            if (rule.patch_type === 'theme_block' && rule.patch_template) {
                const blockType = rule.condition.type === 'theme_block_missing' ? rule.condition.block_type : '';
                patchPayload = {
                    type: 'theme_block',
                    target: 'product_page',
                    block_type: blockType,
                    settings: rule.patch_template.settings ?? {},
                };
            }
            else if (rule.patch_type === 'product_metafield') {
                patchPayload = { type: 'product_metafield', product_id: product.id, namespace: 'conversion_optimizer', key: 'benefit_bullets', value_type: 'list.single_line_text_field', value: [] };
            }
            else if (rule.patch_type === 'product_field') {
                patchPayload = { type: 'product_field', product_id: product.id, field: 'descriptionHtml', value: '' };
            }
            patchPayload = {
                ...(patchPayload ?? {}),
                context: {
                    targetLabel,
                    issueDetail,
                    productId: product.id,
                    productHandle: product.handle,
                },
            };
            out.push({ rule, entityType: 'product', entityId: product.id, rationale, patchPayload });
        }
    }
    return out;
}
function runGlobalRules(theme) {
    const out = [];
    for (const rule of rule_registry_1.CRO_RULES) {
        if (!rule.entity_types.includes('global'))
            continue;
        if (rule.condition.type !== 'theme_block_missing')
            continue;
        const matches = evaluateConditionForTheme(rule.condition, theme);
        if (!matches)
            continue;
        const rationale = rule.description;
        const c = rule.condition;
        const patchPayload = {
            type: 'theme_block',
            target: c.context,
            block_type: c.block_type,
            settings: rule.patch_template?.settings ?? {},
            placement_hint: 'above_add_to_cart',
            context: {
                targetLabel: themeContextLabel(c.context),
                issueDetail: `${themeContextLabel(c.context)} is missing block: ${c.block_type}.`,
            },
        };
        out.push({ rule, entityType: 'global', entityId: 'theme', rationale, patchPayload });
    }
    return out;
}
