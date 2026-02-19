# Run compliance webhooks registration (one-time)

The **shopify.app.toml** in the project root already defines the three mandatory compliance webhooks. To register them with Shopify, run these commands from your machine.

---

## 1. Fix npm permissions (if you see EACCES)

If `npm install -g` or `npx` fails with permission errors on `.npm`:

```bash
sudo chown -R $(whoami) ~/.npm
```

---

## 2. Install Shopify CLI (if not installed)

```bash
npm install -g @shopify/cli@latest
```

Or use **npx** without installing:

```bash
npx @shopify/cli@latest --version
```

---

## 3. Link this project to your app

From the **project root** (the folder that contains `shopify.app.toml`):

```bash
cd "/Users/admin/Downloads/SHOPIFY PROJECT"
shopify app config link
```

When prompted, choose your **ConversionOptimizer** app (and organization if asked). This links the toml to that app.

---

## 4. Deploy config (registers webhooks)

```bash
shopify app deploy
```

Confirm if the CLI asks to create/release a version. This pushes the webhook configuration to Shopify; your Railway backend is unchanged.

---

## 5. Re-run automated checks

In **Partners** → **ConversionOptimizer** → **Distribution** → **Automated checks for common errors** → click **Run**. The compliance webhook and HMAC checks should pass.

---

**If you use a different backend URL** than `https://conversion-optimizer-api-production.up.railway.app`, edit `shopify.app.toml` and set `application_url` to that URL (no trailing slash), then run steps 3–4 again.
