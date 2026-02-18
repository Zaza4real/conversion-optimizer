# Web Pixel and Theme App Extension design

## 1. Web Pixel event schema

### Event types we consume

| Event | When | Use |
|-------|------|-----|
| `page_view` | Every page | Funnel step; LCP/performance props if we add them |
| `product_view` | Product page viewed | Product-level funnel; experiment exposure |
| `add_to_cart` | Add to cart | Secondary metric |
| `begin_checkout` | Checkout started | Funnel |
| `purchase` | Order completed | Primary outcome; revenue |

### Payload we send to our ingestion endpoint

Pixel runs in Shopify’s context. We can subscribe to standard events and (per Shopify pixel docs) send to a custom endpoint. Our backend exposes `POST /pixel/events` that accepts batched events.

**Single event shape (we normalize from Shopify payload + our additions):**

```json
{
  "event_type": "product_view",
  "timestamp": "2025-02-18T12:00:00.000Z",
  "anon_id": "opaque_stable_visitor_id",
  "session_id": "opaque_session_id",
  "props": {
    "url": "https://store.com/products/handbag",
    "product_id": "gid://shopify/Product/123",
    "currency": "USD",
    "value": 99.00
  },
  "experiment_id": "uuid-of-experiment",
  "variant": "control"
}
```

- **anon_id:** Stable across sessions. Generated in pixel: if `localStorage.conversion_optimizer_anon_id` exists, use it; else generate UUID, persist to `localStorage` (and optionally cookie for cross-subdomain). Never PII.
- **session_id:** New per session (e.g. tab open). Generate UUID on first event in session; store in `sessionStorage` (or cookie with short TTL).
- **experiment_id / variant:** Present only when the current page is part of an experiment and we’ve determined the variant (see Assignment below).

**Purchase:** We send the same structure; `props` includes `order_id` (if available from checkout pixel payload), `value` (total), `currency`. We match to `orders_cache` by order_id and can attach experiment_id/variant from last exposure in session.

### Persistence of anon_id and session_id

- **anon_id:** `localStorage.conversion_optimizer_anon_id` (primary). Fallback: cookie `co_anon` (e.g. 1 year) so we get stability even if localStorage is cleared on some browsers.
- **session_id:** `sessionStorage.conversion_optimizer_session_id`. Fallback: cookie `co_ses` (e.g. 30 min TTL).
- Pixel script (in Web Pixel Extension): on load, read or create these; attach to every event sent to our endpoint. Same script can do deterministic bucketing and attach `experiment_id`/`variant` when the page declares active experiments (see below).

### Deterministic bucketing and assignment persistence

- **Inputs:** `experiment_id`, `anon_id`, allocation map (e.g. `{ control: 0.5, variant_a: 0.5 }`).
- **Algorithm:** `hash = sha256(anon_id + experiment_id)`, take first 8 bytes as uint64, divide by 2^64 → [0,1). Map to variant by cumulative allocation. Deterministic: same anon_id + experiment_id → same variant.
- **Persistence:** In pixel, after computing variant, set `localStorage.conversion_optimizer_exp_<experiment_id> = variant` so we don’t recompute and so we stay consistent. Optionally send assignment to backend (POST /pixel/assignments) for durability; backend can store in `assignments` and/or Redis.
- **Exposure:** When we render the experiment (e.g. CTA variant), we send one `exposure` event (or tag on `product_view`): `event_type: "experiment_exposure"`, `experiment_id`, `variant`. This is separate from outcome events so we can count “visitors who saw variant” in the denominator.

### Pixel extension implementation notes

- Extension config: list of events to subscribe to; our script registers and forwards to `BACKEND_URL/pixel/events` with auth (e.g. shop-scoped API key in header, or signed JWT). Shopify sends standard event payload; we merge in anon_id, session_id, and experiment assignment from our script.
- Script runs in storefront; we inject minimal JS that: (1) ensures anon_id/session_id, (2) loads experiment config for current page (from app embed or a tiny JSON in the page), (3) computes/reads assignment, (4) subscribes to Shopify pixel events and forwards to our API with the extra fields.

---

## 2. Theme App Extension architecture

### Blocks (sections merchants can add)

| Block | Purpose | Settings (Liquid schema) | Patch mapping |
|-------|---------|---------------------------|---------------|
| Trust / Guarantee | Badge or short copy (e.g. “Free returns”, “2-year warranty”) | heading, body text, icon (optional), style (minimal/badge) | recommendation → preset or custom copy |
| Shipping & Returns | Shipping times, costs, returns policy summary | heading, shipping_copy, returns_copy, link_to_policy | from scan: “missing shipping” → suggest copy |
| FAQ | Accordion or list | heading, items (question + answer) | AI-generated FAQ patch |
| Urgency / Stock | “Only 3 left”, “Ships in 24h” | template (stock/urgency/shipping), threshold, fallback_copy | from product metafield or variant inventory |
| Social proof | “Join 10k customers” or review snippet | type (count/review_stars), copy, source (optional) | if reviews app detected, show stars |

Each block: Liquid + CSS in extension; settings in `blocks/*.liquid` schema. No direct backend call in render path; copy and config come from block settings. When we “apply” a patch for a block, we write to theme extension config (if we have an API for that) or we output instructions for the merchant (“Add this block and paste this copy”); for v1 the cleanest is “apply” = we update our app’s stored config and the block reads from **app embed** that injects config per page (see below). So: block content can be static from settings, or dynamic from app embed JSON.

### App embed

- Single app embed: “Conversion Optimizer”. Loads one script (and optionally a small JSON payload).
- Script responsibilities:
  - **Experiment toggles:** Read experiment config (e.g. from a script tag with `id="conversion_optimizer_config"` and JSON inside, or from a minimal API call to our backend with shop + path). Config lists active experiments for this page (e.g. `[{ "id": "exp_uuid", "target": "product_page_cta", "variants": { "control": {}, "variant_a": { "cta_text": "Add to bag" } } }]`). Script runs deterministic bucketing (or reads from localStorage), then applies variant: e.g. replace CTA text, show/hide a block, or set data attributes for the block to read.
  - **Exposure logging:** After applying variant, dispatch one exposure event to our pixel (or our endpoint) with experiment_id + variant so we can log it in `events` with `event_type = 'experiment_exposure'`.
- How variant “changes” render: (1) **CTA copy:** We target a data attribute or class (e.g. `[data-co-cta]`); script finds it and sets textContent from variant. (2) **Block on/off:** We target block container by data attribute; script shows/hides. (3) **Trust block copy:** Block can read from `window.conversionOptimizer?.blockCopy?.trust` if we inject it from app embed; else use Liquid settings only. For v1 we keep it simple: experiments only change elements we explicitly tag (e.g. one CTA and one “trust” block visibility). Theme extension provides the blocks; merchant adds them; our embed only toggles visibility or copy for experiments.

### Which blocks, settings, and variant rendering summary

- **Blocks:** Trust/Guarantee, Shipping & Returns, FAQ, Urgency/Stock, Social proof. All have Liquid schema with text/options; no backend in Liquid.
- **Settings:** Per-block: headings, body copy, style. Global (in app embed config): experiment list for current request; per-variant copy or visibility.
- **Variant rendering:** App embed JS gets assignment → updates DOM (text or visibility) for elements with `data-co-*` attributes; then sends exposure event. New visitors get consistent variant; returning visitors get same variant via anon_id.

### Optional checkout extension

- Not required for v1. If we add it later: Checkout UI Extension for a single block (e.g. post-purchase upsell or trust line). Architect so all experiment and attribution logic still works without it (purchase event from pixel is enough for conversion and revenue).

---

## 3. File layout (extensions)

**Theme extension (Shopify CLI structure):**

- `extensions/theme-extension/blocks/trust.liquid` + schema
- `extensions/theme-extension/blocks/shipping_returns.liquid` + schema
- `extensions/theme-extension/blocks/faq.liquid` + schema
- `extensions/theme-extension/blocks/urgency_stock.liquid` + schema
- `extensions/theme-extension/blocks/social_proof.liquid` + schema
- `extensions/theme-extension/assets/embed.js` — experiment toggles + exposure

**Pixel extension:**

- `extensions/pixel-extension/src/index.js` (or the file that registers subscriptions and sends to our API) — subscribe to standard events; add anon_id, session_id, assignment; POST to backend.
