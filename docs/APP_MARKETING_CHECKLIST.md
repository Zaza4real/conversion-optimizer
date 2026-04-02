# Marketing Conversion Optimizer — checklist

Use this to get more installs and reviews once the app is live on the Shopify App Store.

---

## 1. App Store listing (Partners → Distribution → Listing)

- **App name:** Conversion Optimizer (keep consistent).
- **Tagline:** Use the one in `docs/APP_STORE_LISTING.md` — benefit-focused, under 70 chars.
- **Description & features:** Paste from APP_STORE_LISTING.md; avoid keyword stuffing.
- **Screenshots:** At least 3–4: app home (with plans), Run scan, Recommendations list, optional Export CSV. Real UI, no stock art.
- **Category:** e.g. Marketing and conversion.
- **Search terms:** Up to 5 (e.g. conversion, CRO, store audit, product page, trust signals). One idea per term.
- **Support URL:** Your help page or email (e.g. support@yourdomain.com or a simple FAQ page). Filling this builds trust and can reduce refunds.

---

## 2. Reviews and ratings

- **In-app “Leave a review” link:** Set the env var **`APP_STORE_LISTING_URL`** on your backend (e.g. Railway) to your app’s public listing URL (e.g. `https://apps.shopify.com/conversion-optimizer` or whatever your app handle is). The app footer will then show “Leave a review” next to Billing status, opening the App Store listing so merchants can rate the app. Good reviews improve ranking and trust.
- **When to ask:** After a merchant has run a scan and viewed recommendations (they’ve seen value). The link is always in the footer; you can later add a one-time “Enjoying the app? Leave a review” message after first scan if you want.
- **Where to get the link:** In Partners → your app → Distribution → the public URL to your app’s listing page.

---

## 3. Crawler access (Online Store → Preferences)

**What it is:** A Shopify setting that lets you **authorize specific external tools** to crawl your **storefront** using signed HTTP requests (Signature, Signature-Input, Signature-Agent). It’s for trusted SEO crawlers, monitoring tools, or other services that need to access your store in a controlled way.

**Do you need it for the app?** No. Conversion Optimizer doesn’t crawl the store; it uses the Shopify API. You can ignore “Crawler access” unless you use a third‑party tool that requires it.

**Does it market your app?** Not directly. It affects how *your store* (e.g. conversionoptimizer.myshopify.com) can be indexed or monitored by external tools. It doesn’t promote your app in the App Store.

---

## 4. What actually helps market the app

| Action | Why it helps |
|--------|----------------|
| Strong listing (copy + screenshots) | Better search and conversion in the App Store. |
| Support/contact link | Trust; fewer “no support” complaints. |
| Clear pricing, no hidden fees | Fewer refunds and negative reviews. |
| “Leave a review” link in app | More positive reviews → better ranking and social proof. |
| Fast support replies | Better reviews and retention. |
| Optional: Simple landing page or help site | SEO and credibility; link from listing. |

---

## 5. Optional: Paid App Store ads

In Partners you can apply for **App Store ads** (search/category ads). Only approved apps can run them. Improves visibility for relevant searches.

---

**Summary:** Crawler access = store-level setting for external tools; skip it unless you need it. Focus listing, screenshots, support link, and in-app “Leave a review” to market the app.
