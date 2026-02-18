# Rollback and patch versioning

## 1. Principles

- Every apply stores a patch row with `payload` (what we applied) and `rollback_payload` (previous state or explicit “remove”).
- Changes are reversible with one click: “Rollback” re-applies `rollback_payload`.
- We keep versioning so that re-applying to the same target creates a new version; rollback goes to previous version for that target.

---

## 2. Patch versioning model

- **applied_to:** Unique logical target per shop, e.g. `product:gid://shopify/Product/123` (title), `product:gid://shopify/Product/123:metafield:benefit_bullets`, `theme_block:trust:section_xyz` (if we ever write block config by id).
- **version:** Integer. When we apply a new patch to the same `applied_to`, we look up the latest patch for that key; set `version = previous.version + 1`. Rollback payload for the new row = previous row’s payload (so rolling back “undoes” the latest apply).
- **Rollback flow:** User clicks “Rollback” on patch P. We load P.rollback_payload and execute it (e.g. productUpdate with previous title, or metafield delete). Then we insert a new patch row with payload = P.rollback_payload and rollback_payload = P.payload (so “rollback of rollback” restores the changed state). Version increments. Alternatively we don’t insert a new row for rollback and just mark “reverted” and keep history read-only; then “re-apply” would create a new patch. Simpler: rollback = execute rollback_payload once; add a `rolled_back_at` on original patch; no new row. So we have one row per “apply”; rollback just runs the rollback and marks the row rolled_back_at = now().

---

## 3. Rollback payload shapes

- **Product title/description:** `{ "type": "product_field", "product_id": "...", "field": "title", "value": "Old title" }`. Execute via GraphQL productUpdate.
- **Product metafield:** `{ "type": "product_metafield", "product_id": "...", "namespace": "...", "key": "...", "value": "...", "value_type": "..." }` for set; or `{ "type": "product_metafield_delete", "product_id": "...", "key": "..." }` if we added new and rollback = remove.
- **Theme block:** We can’t remove blocks via API. Rollback = “merchant_instruction”: “Remove the Conversion Optimizer trust block from this section” and/or we store previous block settings and re-apply those if our extension supports “config from API”. For v1, theme block “rollback” is instructions only unless we have a way to push previous settings.

---

## 4. UI

- Patches list: show applied_to, applied_at, version, “Rollback” button. If rolled_back_at set, show “Reverted” and optionally “Re-apply” (re-run the same payload).
- Before rollback: confirm modal. After success: refresh and show “Reverted successfully.”

---

## 5. Idempotency

- Apply: if we send the same payload again (e.g. retry), check if latest patch for applied_to already has same payload hash; skip or return success.
- Rollback: only one rollback per patch row (set rolled_back_at once); second click returns “Already reverted.”
