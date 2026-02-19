# Fix: App icon upload + Compliance webhooks (Distribution checklist)

Use this when **Distribution → Preliminary steps** shows the listing created but you need the **app icon** location, or when **Automated checks** fail on compliance webhooks / HMAC.

---

## 1. Where to upload the app icon

On **Partners → ConversionOptimizer → Distribution**:

- Click **Edit** next to **"Created listing (English)"**.
- In the listing flow, go to **Basic app information** (or the first section where you set app name, category, etc.).
- Look for **"App icon"** or **"Add icon"** — upload `docs/assets/app-icon-1200.png` (1200×1200 PNG) there.
- Save.

If you don’t see an icon field there, try **Partners → your app → Settings** (or **Configuration**) and look for **App icon** / **Branding**.

---

## 2. Fix: "Provides mandatory compliance webhooks" (red X)

Shopify requires **three** compliance webhook endpoints to be **registered** and **reachable**. Your backend already implements them and verifies HMAC; they just need to be registered.

Use **one** of these two methods.

---

### Method A: Register via Shopify CLI (recommended — we did this for you)

A **`shopify.app.toml`** file is in your project root with the three compliance webhooks already defined. Use it to push the config to your app:

1. **Install Shopify CLI** (if needed):  
   `npm install -g shopify-cli` or see [Shopify CLI](https://shopify.dev/docs/api/shopify-cli).

2. **Open the project root** (the folder that contains `shopify.app.toml`):
   ```bash
   cd "/Users/admin/Downloads/SHOPIFY PROJECT"
   ```

3. **Link this config to your existing app**:
   ```bash
   shopify app config link
   ```
   When asked, choose your **ConversionOptimizer** app (and the right org if you have several). This links the toml to that app.

4. **Push the configuration** (registers the webhooks with Shopify):
   ```bash
   shopify app deploy
   ```
   If the CLI asks to create a version or release, confirm. Your app URL in the toml is already set to your Railway URL; deploy only updates **configuration** (including webhooks), not your backend code.

5. **Re-run automated checks**: **Partners → Distribution → Automated checks for common errors** → click **Run**.

**If you use a different backend URL**, edit `shopify.app.toml` and set `application_url` to that URL (no trailing slash), then run steps 3–5 again.

---

### Method B: Register in the Dashboard (if you can’t use CLI)

1. **Dev Dashboard (dev.shopify.com)**  
   - Go to **Apps → ConversionOptimizer → Versions**.  
   - Open the **active version** (or click **Create a version**).  
   - In the version screen, look for **Configuration**, **Subscriptions**, or **Webhooks**.  
   - Add these three **HTTPS** subscription URLs (replace with your real app URL if different):

   | Topic                    | URL |
   |--------------------------|-----|
   | Customers data request  | `https://conversion-optimizer-api-production.up.railway.app/api/webhooks/shopify/customers/data_request` |
   | Customers redact        | `https://conversion-optimizer-api-production.up.railway.app/api/webhooks/shopify/customers/redact` |
   | Shop redact             | `https://conversion-optimizer-api-production.up.railway.app/api/webhooks/shopify/shop/redact` |

   Save / release the version.

2. **Partners (partners.shopify.com)**  
   - Go to **Apps → ConversionOptimizer**.  
   - Try in order: **Settings** (gear) → **API** or **Webhooks** or **Event subscriptions** or **Configuration**.  
   - If you see **Compliance webhooks** or **Mandatory webhooks** (or a list where you can add subscription URLs), add the same three URLs as in the table above.  
   - Save.

3. **Re-run automated checks**: **Distribution → Automated checks for common errors** → **Run**.

---

## 3. Fix: "Verifies webhooks with HMAC signatures" (red X)

Your backend **does** verify HMAC (it returns `401 Invalid HMAC` when the signature is wrong). This check often fails if:

1. **Compliance webhooks aren’t registered** — Fix section 2 above first, then run the checks again.
2. **Raw body is lost** — The app is already configured with `rawBody: true` in `main.ts` so HMAC verification works. If you use a proxy or middleware that parses the body before it reaches Nest, ensure the raw body is still available for the webhook controller.
3. **Wrong secret** — In Railway (or your host), ensure **SHOPIFY_API_SECRET** is the **Client secret** from Partners (Settings → Client credentials). If it’s wrong, computed HMAC won’t match and Shopify’s test will get 401.

After registering the compliance webhooks and confirming the secret, click **Run** again on the Distribution automated checks.

---

## Quick checklist

- [ ] App icon uploaded via **Edit** next to “Created listing (English)” (or in Settings/Configuration).
- [ ] All three compliance webhook URLs added in Partners (customers/data_request, customers/redact, shop/redact).
- [ ] `SHOPIFY_API_SECRET` in Railway matches Partners Client secret.
- [ ] **Run** clicked on Automated checks; both compliance and HMAC checks pass.
