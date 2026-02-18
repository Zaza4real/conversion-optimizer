# AI generation: prompts and output schema

## 1. Pipeline

- **Input:** Product (title, description, type), brand voice settings (tone, taboo words, claim strictness, reading level, locale), optional existing copy.
- **Output:** Strict JSON only. No free-form prose in the API response; we parse JSON and validate against schema. If parsing fails or validation fails, retry once with “output valid JSON only” or return error and show “Generate again” in UI.

---

## 2. Brand voice settings (stored in shops.settings)

```json
{
  "brand_voice": {
    "tone": "professional|friendly|playful|luxury|minimal",
    "taboo_words": ["cheap", "discount", "..."],
    "claim_strictness": "strict|moderate|relaxed",
    "reading_level": "6th_grade|8th_grade|10th_grade|college",
    "locale": "en-US",
    "max_sentence_length": 20,
    "avoid_superlatives": true
  }
}
```

- **claim_strictness:** strict = no health/financial guarantees, no “best”, “#1”; moderate = allow some; relaxed = minimal filtering.
- **reading_level:** target Flesch-Kincaid; model adjusts sentence length and vocabulary.

---

## 3. Compliance guardrails (always applied)

- **No medical/financial guarantees** — e.g. “cures”, “investment returns”. Flag and do not output or require manual approval.
- **No false scarcity** — e.g. “Only 2 left” when inventory is high. We can check against inventory in post-processing.
- **Risky claims detector:** Before returning JSON, run a small classifier or keyword list; if risk detected, add `"risk_flags": ["possible_medical_claim"]` and set `"requires_approval": true`. UI shows diff and “Approve” before apply.

---

## 4. Prompt template (product copy)

System:

```text
You are a conversion-focused copywriter for e-commerce. Output only valid JSON. No markdown, no explanation. Follow the schema exactly. Tone: {{tone}}. Reading level: {{reading_level}}. Locale: {{locale}}. Do not use: {{taboo_words}}. Claim strictness: {{claim_strictness}} — do not make medical or financial guarantees; avoid false scarcity. Avoid superlatives if avoid_superlatives is true.
```

User (per product):

```text
Product type: {{product_type}}
Current title: {{title}}
Current description (excerpt): {{description_excerpt}}

Generate the following. Output only this JSON object:
{
  "title_options": [3 strings, under 70 chars each],
  "subtitle": "one short line under 120 chars",
  "benefit_bullets": [3-5 strings, one benefit each, under 100 chars],
  "objection_handling": [2-3 Q&A pairs: { "q": "...", "a": "..." }],
  "shipping_returns_snippet": "2-3 sentences for shipping and returns",
  "cta_primary": "e.g. Add to bag",
  "cta_secondary": "e.g. Subscribe for 10% off",
  "risk_flags": ["string or empty array"],
  "requires_approval": false
}
```

We validate: title_options length, benefit_bullets count, no empty required strings. If risk_flags non-empty, we set requires_approval true in our backend even if model said false.

---

## 5. JSON output schema (validator)

```typescript
const ProductCopySchema = z.object({
  title_options: z.array(z.string().max(70)).min(1).max(5),
  subtitle: z.string().max(120).optional(),
  benefit_bullets: z.array(z.string().max(100)).min(2).max(6),
  objection_handling: z.array(z.object({
    q: z.string().max(200),
    a: z.string().max(500)
  })).min(0).max(5),
  shipping_returns_snippet: z.string().max(500),
  cta_primary: z.string().max(50),
  cta_secondary: z.string().max(50).optional(),
  risk_flags: z.array(z.string()),
  requires_approval: z.boolean()
});
```

Use Zod (or JSON Schema) in backend; on failure return 422 and do not save. “Diff view” in UI: show current vs each suggested field side-by-side; “Approve” sends selected option to apply (patch).

---

## 6. FAQ-only generation (for block)

Separate prompt for “generate FAQ for this product” when recommendation is “no FAQ”:

```text
Output only JSON: { "faq": [ { "q": "...", "a": "..." } ] } with 3-5 items. Max 200 chars per q, 400 per a. No medical/financial guarantees. Tone: {{tone}}.
```

Validate: faq array length, char limits.

---

## 7. File layout

- `apps/backend/src/ai/prompts/product-copy.ts` — system + user template, variable substitution.
- `apps/backend/src/ai/schemas/product-copy.ts` — Zod schema and parse function.
- `apps/backend/src/ai/guardrails/claim-check.ts` — keyword/pattern check for risk_flags.
- `apps/backend/src/ai/ai-copy.service.ts` — call LLM (e.g. OpenAI/Anthropic), parse, validate, apply guardrails.
