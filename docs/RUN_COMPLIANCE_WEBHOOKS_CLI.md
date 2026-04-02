# Run compliance webhooks registration (one-time)

The **shopify.app.toml** in the project root already defines the three mandatory compliance webhooks and your app’s **client_id**. The Shopify CLI is installed as a dev dependency (`pnpm exec shopify`). You only need to **log in once** in your terminal, then run the deploy.

---

## 1. One-time: log in to Shopify (in your terminal)

From the **project root**:

```bash
cd "/Users/admin/Downloads/SHOPIFY PROJECT"
pnpm exec shopify auth login
```

Log in with the **Partners account that owns ConversionOptimizer** (the same account where you see the app in Partners). Complete the browser flow.

---

## 2. Link this project to your app (picks the correct Client ID)

Run:

```bash
pnpm shopify:link
```

When the CLI shows a list of apps, select **ConversionOptimizer** (and the right organization if asked). This writes the correct `client_id` to `shopify.app.toml` for the account you’re logged into. If you skip this and deploy with a wrong or old Client ID, you’ll get “No app with client ID … found”.

---

## 3. Deploy config (registers webhooks)

```bash
pnpm shopify:deploy
```

This pushes the webhook configuration to Shopify; your Railway backend is unchanged.

---

## 4. Re-run automated checks

In **Partners** → **ConversionOptimizer** → **Distribution** → **Automated checks for common errors** → click **Run**. The compliance webhook and HMAC checks should pass.

---

**If you use a different backend URL** than `https://conversion-optimizer-api-production.up.railway.app`, edit `shopify.app.toml` and set `application_url` to that URL (no trailing slash), then run step 2 again.
