# Testing Conversion Optimizer

## 1. Approve the subscription

On the **Approve subscription** screen, click **Approve**. Shopify will charge $19/month and redirect you back to the app. The backend will mark your shop as paid.

---

## 2. What you’ll see in the app

After approval you’ll land on the app home (inside Shopify Admin). You should see:

- **Store:** your store domain  
- **Manage billing** (instead of Subscribe)  
- **Test** section with:
  - **Run scan** — button to start a CRO scan for your store  
  - **View recommendations** — link that returns JSON recommendations  

---

## 3. How to test

### Billing

- **Billing status:** Open the “billing status” link (or `GET /api/billing/status?shop=your-store.myshopify.com`). You should see `subscribed: true`.

### Scan

- Click **Run scan**. The backend enqueues a job (BullMQ + Redis), runs product/theme rules, and writes recommendations to the DB.
- Response is JSON with `jobId`. You can check status with `GET /api/scan/job/{jobId}`.

### Recommendations

- Click **View recommendations** (or `GET /api/recommendations/your-store.myshopify.com?limit=10`). You get JSON of recommendations for the shop. After at least one scan, this list will be populated.

---

## 4. Console warnings

Warnings like “SES Removing unpermitted intrinsics” or “deprecated parameters” usually come from Shopify’s scripts or the browser, not your app. They don’t stop the app from working.

---

## 5. Quick API checks (optional)

Replace `YOUR-STORE` with your store domain (e.g. `conversionoptimizer.myshopify.com`).

```bash
# Billing status
curl "https://conversion-optimizer-api-production.up.railway.app/api/billing/status?shop=YOUR-STORE.myshopify.com"

# Run scan (requires paid plan)
curl -X POST "https://conversion-optimizer-api-production.up.railway.app/api/scan/YOUR-STORE.myshopify.com"

# Recommendations (requires paid plan)
curl "https://conversion-optimizer-api-production.up.railway.app/api/recommendations/YOUR-STORE.myshopify.com?limit=10"
```
