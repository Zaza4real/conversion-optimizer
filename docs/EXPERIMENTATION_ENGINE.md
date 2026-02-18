# Experimentation engine

## 1. Design choices

- **Deterministic bucketing:** Hash(anon_id + experiment_id) → [0,1) → variant. Same visitor always sees same variant; no cross-session flicker.
- **Exposure vs outcome:** We log exposure (who saw which variant) separately from outcome events (add_to_cart, purchase). Conversion rate = purchases / exposed visitors per variant.
- **Primary metric:** Purchase conversion rate (purchase_count / visitors with exposure). Secondary: add_to_cart rate, begin_checkout rate, revenue per visitor, AOV.
- **Statistics:** Bayesian with credible intervals. Easier to interpret (“90% chance variant beats control by 0.5–3%”) and we can stop early without peeking correction. Prior: weak (e.g. Beta(1,1)). Posterior: Beta(alpha + purchases, beta + non-purchases) per variant. Compare posteriors (e.g. P(variant > control) and credible interval on lift).
- **Stopping rules:** (1) Minimum sample: e.g. 500 visitors per variant before we allow “winner” call. (2) Max duration: e.g. 14 days. (3) Early stop only if posterior probability that variant beats control > 0.95 and credible interval excludes 0 (no arbitrary peeking; we can run a single check at min sample).
- **Guardrails:** Don’t recommend rollout if (a) mobile segment regresses (revenue or conversion down), (b) revenue per visitor drops beyond threshold (e.g. >5%), (c) insufficient data or tracking gaps (e.g. >20% of purchases without exposure). “Experiment quality” warnings in UI.

---

## 2. Assignment (pseudocode)

```text
function getVariant(experimentId, anonId, allocation):
  key := "co_exp_" + experimentId
  cached := localStorage.getItem(key)
  if cached in allocation then return cached

  hash := SHA256(anonId + experimentId)
  u := first 8 bytes of hash as uint64 / 2^64   // [0, 1)
  cum := 0
  for (variant, p) in allocation (ordered):
    cum += p
    if u < cum then
      localStorage.setItem(key, variant)
      return variant
  return last variant
```

Backend can replicate this for server-side assignment (e.g. for email or API). Store assignment in `assignments` and/or Redis key `assignment:{shop_id}:{experiment_id}:{anon_id}` with TTL = experiment end + 30 days.

---

## 3. Exposure logging

- In pixel/embed: after resolving variant, send one event: `event_type: "experiment_exposure"`, `experiment_id`, `variant`, `anon_id`, `session_id`, `ts`, optional `props.url`, `props.target`.
- Backend: `POST /pixel/events` receives it; insert into `events` with `experiment_id` and `variant` set. No duplicate exposure per (shop_id, experiment_id, anon_id) in same day: either idempotent insert or upsert by (shop_id, experiment_id, anon_id, date(ts)).

---

## 4. Outcome aggregation (worker)

- **Input:** experiment_id, time window (e.g. since started_at).
- **Query:** From `events`: (1) Exposed visitors: distinct (anon_id) where event_type = 'experiment_exposure' and experiment_id = X. (2) Per variant: count exposures (or distinct anon_id), count add_to_cart, begin_checkout, purchase; sum revenue from purchase events or joined orders_cache.
- **Output:** Upsert `results_aggregates`: one row per (experiment_id, variant, segment). Segment = 'all' or 'mobile'/'desktop' (from props), 'new'/'returning' (first session vs not). Metrics: visitors, views, add_to_cart, begin_checkout, purchase, revenue.

```text
for each (experiment_id, variant, segment):
  visitors := COUNT(DISTINCT anon_id) FROM events
    WHERE event_type = 'experiment_exposure' AND experiment_id = ? AND variant = ?
    [AND segment filter]
  purchase := COUNT(*) FROM events
    WHERE event_type = 'purchase' AND experiment_id = ? AND variant = ?
    [AND anon_id in exposed set for this variant]
  revenue := SUM(props->>'value') FROM same purchase events
  add_to_cart, begin_checkout := same idea
  UPSERT results_aggregates (experiment_id, variant, segment, visitors, purchase, revenue, ...)
```

Attribution: a purchase is attributed to a variant if we have an exposure for that (anon_id, experiment_id) with that variant (same session or last exposure in a time window). Store experiment_id/variant on purchase event when we have a matching exposure.

---

## 5. Statistical evaluation (pseudocode)

- **Input:** results_aggregates for experiment_id, variant A vs B (or control vs one variant).
- **Model:** Beta-Binomial. Prior Beta(1,1). For each variant: successes = purchase, failures = visitors - purchase. Posterior: Beta(1 + purchase, 1 + visitors - purchase).
- **Sample from posterior:** e.g. 10k draws. For each draw: conversion_A, conversion_B; lift = (conversion_B - conversion_A) / conversion_A. Compute P(B > A), 5th and 95th percentile of lift.
- **Stopping rules:**
  - If visitors per variant < min_sample (e.g. 500): status = "running", no winner.
  - If P(B > A) >= 0.95 and 95% CI for lift > 0: suggest B as winner; if guardrails pass (mobile/revenue check), status = "winner_recommended".
  - If max_duration reached and no clear winner: status = "inconclusive".
- **Guardrails:** Compare segment "mobile" and "desktop" separately; if B wins overall but mobile conversion drops > X%, don’t recommend. Same for revenue per visitor.

---

## 6. Segmentation

- **Device:** From pixel `props` (e.g. user_agent or client hint). Store in events; aggregate by segment = 'mobile' | 'desktop'.
- **New vs returning:** First event with this anon_id in last 90 days = new; else returning. Compute in aggregation or store in events.
- **Traffic source:** If we get it from referrer or UTM in props, segment by source (social, search, email, direct). v1 can be "all" only; v2 add segments.

---

## 7. Experiment quality warnings

- **Insufficient data:** visitors < 500 per variant → “Run longer or increase traffic.”
- **Tracking gaps:** % of purchases with no matching exposure (e.g. cross-device or pixel blocked) > 20% → “Some orders can’t be attributed; results may be biased.”
- **Imbalance:** Ratio of visitors control vs variant far from allocation (e.g. 30/70 instead of 50/50) → “Check for targeting or bucketing issues.”

Surface these in the experiment detail UI so the merchant understands confidence.
