# Recommendation engine

## 1. Rule format (JSON)

Each CRO “lint” rule is a JSON object that the scanner can evaluate and optionally produce a recommendation.

```json
{
  "id": "trust_above_fold_guarantee",
  "category": "trust",
  "entity_types": ["product", "global"],
  "severity": "high",
  "title": "Add a clear guarantee above the fold",
  "description": "Product pages with a visible guarantee near the fold convert better.",
  "evaluate": "rule",
  "condition": {
    "type": "theme_block_missing",
    "block_type": "trust_guarantee",
    "context": "product_page"
  },
  "patch_type": "theme_block",
  "patch_template": {
    "block": "trust_guarantee",
    "settings": { "heading": "Our guarantee", "body": "{{suggested_copy}}" }
  },
  "impact_estimate": { "metric": "conversion_rate", "low": 0.01, "high": 0.04 },
  "effort": "low",
  "risk": "low"
}
```

**Rule types (evaluate):**

- `rule` — deterministic check (e.g. block present, field non-empty, count >= N).
- `score` — contributes to a composite score (e.g. image count, word count); threshold or band triggers recommendation.

**Condition types (examples):**

- `theme_block_missing` — our block type not present in active theme for given context (product/page).
- `product_field_empty` — product.title, body_html, or metafield empty or too short.
- `product_field_bad` — e.g. compare_at_price <= price; no alt on images.
- `count_below` — e.g. image_count < 3, bullet_count < 2.
- `copy_quality` — from AI or heuristic: readability score, no benefit bullets, etc. (output of separate step).

**Patch types:**

- `theme_block` — add/configure a block (we output instructions or push config if API allows).
- `product_metafield` — set metafield (e.g. bullets, FAQ) when write_products enabled.
- `product_field` — update title/description when write_products enabled.
- `merchant_instruction` — no automated patch; show “Why” and “How to fix” only.

---

## 2. Scoring engine (prioritization)

For each recommendation we compute:

- **Confidence (0–1):** How sure we are the issue matters. Rule-based: 0.9 for “missing trust block”; 0.6 for “low image count” (weaker evidence). AI-suggested: from model or fixed by category.
- **Effort:** low / medium / high. Affects sort: prefer low effort, high impact.
- **Expected impact:** From rule’s `impact_estimate` or AI. Store as `{ metric, low, high }` (e.g. conversion lift range).
- **Risk:** low / medium / high. Brand/compliance; regression risk. High risk → require manual approval or don’t auto-apply.

**Priority score (for backlog order):**

```text
priority = confidence * impact_mid * effort_multiplier * (1 - risk_penalty)
```

- impact_mid = (low + high) / 2 for the primary metric.
- effort_multiplier: low=1, medium=0.7, high=0.4.
- risk_penalty: low=0, medium=0.2, high=0.5.

Sort by priority descending. Output: list of recommendations with “Why this matters” (rationale), “How we measure success” (metric + guardrails), and patch (if any).

---

## 3. Patch payload design

**theme_block**

```json
{
  "type": "theme_block",
  "target": "product_page",
  "block_type": "trust_guarantee",
  "settings": {
    "heading": "Satisfaction guaranteed",
    "body": "30-day returns. Free shipping over $50."
  },
  "placement_hint": "above_add_to_cart"
}
```

We can’t inject blocks via API; so “apply” either: (1) saves to our DB and theme extension reads “suggested block config” from app embed and renders it (if we support dynamic block content), or (2) shows merchant “Add block X with these settings” and copy-paste. v1: (2) for clarity; (1) if we add “preview” block that reads from our API.

**product_metafield**

```json
{
  "type": "product_metafield",
  "product_id": "gid://shopify/Product/123",
  "namespace": "conversion_optimizer",
  "key": "benefit_bullets",
  "value": ["Benefit 1", "Benefit 2"],
  "value_type": "list.single_line_text_field"
}
```

**product_field**

```json
{
  "type": "product_field",
  "product_id": "gid://shopify/Product/123",
  "field": "title",
  "value": "New suggested title"
}
```

**Rollback:** For each patch we store `rollback_payload`: previous value or “remove block” instruction. So rollback = re-apply rollback_payload (e.g. previous title, or delete metafield).

---

## 4. CRO lint rules (30+ for v1)

**Above-the-fold trust (4)**  
- trust_above_fold_guarantee — missing guarantee block  
- shipping_above_fold — missing shipping info block  
- returns_above_fold — missing returns block  
- contact_visible — no contact/help link in header/footer  

**Product media (5)**  
- image_count_low — < 3 images  
- image_order_packshot_first — no clear main product image first  
- image_alt_missing — images without alt text  
- image_resolution_low — very small image dimensions  
- video_present — (bonus) product video improves engagement  

**Copy quality (6)**  
- no_benefit_bullets — description has no bullet list of benefits  
- copy_too_short — body_html length below threshold  
- copy_readability_high — Flesch-Kincaid too high (complex)  
- no_objection_handling — no FAQ or “what if” copy  
- claim_risk_detected — AI flags risky claims (medical/financial)  
- title_generic — title too generic (AI or keyword check)  

**Pricing (4)**  
- compare_at_sanity — compare_at_price <= price or missing when discount  
- unit_pricing_missing — no unit price for multi-unit products  
- anchor_unclear — no compare-at or “was/now” pattern  
- price_hidden_until_variant — price not visible before variant select  

**Variant UX (4)**  
- default_variant_missing — no default selected  
- out_of_stock_handling — no “notify me” or clear message  
- size_guide_missing — apparel and no size guide link  
- variant_selector_friction — too many options in one selector (e.g. 50 sizes)  

**Reviews (2)**  
- reviews_not_visible — product page has no review snippet (if app detected)  
- review_count_low — very few reviews; consider social proof block  

**Performance (3)**  
- image_weight_high — total image size above threshold (from product data)  
- above_fold_images_count — too many large images above fold  
- script_bloat — (heuristic) theme app extensions count or our own bundle size  

**Mobile / layout (3)**  
- sticky_atc_missing — no sticky add-to-cart on mobile (theme block hint)  
- tap_targets_small — (heuristic from theme structure) small buttons  
- font_size_small — body font size below 16px (from theme or default)  

**Policy / legal (2)**  
- policy_links_missing — no footer policy links  
- shipping_policy_empty — shipping policy page empty or missing  

Each rule has: id, category, severity, condition, patch_type, impact_estimate, effort, risk. Implement as a registry (array or DB) and run in scan job; output to `recommendations` table with entity_type, entity_id, rule_id, rationale, expected_impact, patch_payload, status.

---

## 5. Scan job flow

1. Load shop; fetch active theme (which templates/sections exist; we can’t read Liquid, but we know our blocks are in the extension — so “missing” = merchant hasn’t added them). Fetch product sample (e.g. 50 products) and product template JSON if API gives it.
2. Run rule registry: for each rule, run condition against theme + products. Where condition matches, create recommendation row (or skip if already exists and not stale).
3. Optionally run AI pass on product copy (title, description) for copy_quality and suggested patches; merge into recommendations with patch_payload from AI.
4. Score and sort; return top N (e.g. 20) to dashboard. “Top 10 fixes” = first 10 by priority.
