# First-run experience

## Goal

Connect store → within ~15 minutes see a prioritized list of fixes with impact estimates; optional “apply” and “test” (experiment) without leaving the app.

---

## Flow (minimal)

1. **Install / Connect**  
   Merchant installs app from App Store or link. OAuth: read_products, read_orders, read_themes. Redirect to embedded app with “Welcome” screen.

2. **Scan**  
   Single primary CTA: “Scan my store.” Backend enqueues scan job (fetch theme + products, run CRO rules, optionally first batch of AI copy for a few products). Show progress: “Scanning your store… We’re checking product pages, trust signals, and copy.” Poll job status or use SSE; typical 5–12 minutes for 50–200 products.

3. **Top 10 fixes**  
   When scan completes, redirect or refresh to Dashboard. Show “Your top 10 fixes” — ordered list with:  
   - Short title (e.g. “Add a guarantee above the fold”)  
   - Why it matters (1 line)  
   - Expected impact (e.g. “+1–4% conversion potential”)  
   - Effort (Low/Medium/High)  
   - Primary CTA: “View” (go to recommendation detail) or “Apply” (if patch exists)

4. **Recommendation detail**  
   Single recommendation view: full rationale, expected impact, “How we’ll measure success,” and patch preview (diff for copy). Buttons: “Apply” (or “Apply with changes” if they edit), “Dismiss,” “Run an A/B test instead.”

5. **Apply**  
   If patch is product field/metafield: confirm → backend applies → show “Applied. You can rollback from Patches.” If patch is theme block: show “Add a block” instructions and copy-paste snippet, or “We’ve added this to your theme extension; add the block in the theme editor” if we support that.

6. **Test (optional)**  
   From recommendation or from Experiments: “Run A/B test.” Create experiment (e.g. control vs variant for CTA copy); start. Merchant sees “Experiment running. We’ll notify you when we have a result.” Link to experiment detail with current aggregates and quality warnings.

---

## Copy and tone

- Avoid generic AI phrasing. Use concrete, short sentences. “Your product pages are missing a clear guarantee” not “We’ve identified an opportunity to enhance trust.”
- Numbers: “3 of 12 products have no benefit bullets” not “Some products could improve.”
- One primary action per screen. Secondary actions (Settings, View all recommendations) in nav or footer.

---

## Edge cases

- **Scan fails (theme or API error):** Show “Scan didn’t complete. Retry?” and link to help (e.g. re-install theme extension, check connection).
- **No recommendations:** “Your store looks solid on the basics we checked. We’ll suggest experiments next.” CTA: “Set up an experiment” or “Improve product copy with AI.”
- **Merchant hasn’t added theme extension:** After scan, if we detect our blocks aren’t present, first card: “Install Conversion Optimizer blocks to unlock one-click fixes.” Link to theme editor or step-by-step.
