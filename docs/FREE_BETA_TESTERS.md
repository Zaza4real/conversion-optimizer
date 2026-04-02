# Free beta testers (up to 10 shops)

You can give **full app access for free** to a limited number of testers by allowlisting their shop domains. No payment or trial flow — they install the app and get access immediately.

---

## How it works

1. **Set an env var** on your backend (e.g. Railway):

   ```bash
   FREE_BETA_SHOPS=store1.myshopify.com,store2.myshopify.com,store3.myshopify.com
   ```

   Use the **myshopify.com** domain (e.g. `your-store.myshopify.com`). Comma-separated, no spaces. You can list up to 10 (or more; the app doesn’t hard-cap, but “10 testers” is a typical use).

2. **Testers install the app** from your listing or a direct link. After OAuth they land on the app home.

3. **They get full access** with no subscribe step:
   - Run scan
   - View recommendations
   - Export CSV  

   The app home shows: **“Your plan: Free beta. Full access for testers — no payment required.”** (no Manage billing or Cancel subscription).

4. **No charge** is ever created for these shops. Billing API is not called for them.

---

## Where to set it

- **Railway:** Project → your backend service → Variables → add `FREE_BETA_SHOPS` = `shop1.myshopify.com,shop2.myshopify.com,...`
- **Other hosts:** Add `FREE_BETA_SHOPS` to the environment the same way as `SHOPIFY_APP_URL`, etc.

Redeploy or restart the app after changing the variable.

---

## Getting testers’ shop domains

Each tester’s shop domain is:

- **Store URL without protocol:** `store-name.myshopify.com`  
  They can find it in Shopify Admin: **Settings → Domains** (under “Shopify domain”), or in the browser when they’re in Admin (e.g. `https://store-name.myshopify.com/admin`).

Send them your app install link (e.g. from the Partners dashboard or your listing). Once they install, ask them for their **myshopify.com** domain and add it to `FREE_BETA_SHOPS`, then redeploy.

---

## Turning off free beta for a shop

Remove that shop’s domain from `FREE_BETA_SHOPS` and redeploy. The next time they open the app they’ll see the normal “subscribe to a plan” experience (Run scan / View recommendations will be gated until they subscribe).

---

## Summary

| You do | They get |
|--------|----------|
| Add their `store.myshopify.com` to `FREE_BETA_SHOPS` and deploy | Full access, no payment, “Free beta” plan label |

No code changes needed per tester — only the env var.
