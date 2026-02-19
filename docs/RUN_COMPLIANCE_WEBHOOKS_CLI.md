# Run compliance webhooks registration (one-time)

The **shopify.app.toml** in the project root already defines the three mandatory compliance webhooks and your app’s **client_id**. The Shopify CLI is installed as a dev dependency (`pnpm exec shopify`). You only need to **log in once** in your terminal, then run the deploy.

---

## 1. One-time: log in to Shopify (in your terminal)

From the **project root**:

```bash
cd "/Users/admin/Downloads/SHOPIFY PROJECT"
pnpm exec shopify auth login
```

Complete the browser login when prompted. After that, the CLI can run non-interactively on this machine.

---

## 2. Deploy config (registers webhooks)

Still from the project root:

```bash
pnpm shopify:deploy
```

Or:

```bash
pnpm exec shopify app deploy --allow-updates --allow-deletes
```

This pushes the webhook configuration to Shopify; your Railway backend is unchanged.

---

## 3. Re-run automated checks

In **Partners** → **ConversionOptimizer** → **Distribution** → **Automated checks for common errors** → click **Run**. The compliance webhook and HMAC checks should pass.

---

## Optional: link (only if toml was reset)

If you ever clear or replace `shopify.app.toml` and need to re-link to ConversionOptimizer:

```bash
pnpm shopify:link
```

(Your current toml already has `client_id` set, so you can go straight to deploy after login.)

---

**If you use a different backend URL** than `https://conversion-optimizer-api-production.up.railway.app`, edit `shopify.app.toml` and set `application_url` to that URL (no trailing slash), then run step 2 again.
