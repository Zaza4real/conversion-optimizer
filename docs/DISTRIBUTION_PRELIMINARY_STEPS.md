# Distribution preliminary steps — get all checkmarks

This guide walks you through each **Preliminary steps** item on **Partners → ConversionOptimizer → Distribution** so every item shows a green checkmark.

---

## 1. Fix requirement issues: Add an app icon

**What’s missing:** “Add an app icon so merchants can identify your app.”

**What to do:**

1. In **Partners** go to **Apps** → **ConversionOptimizer** → **Distribution** (or **App setup** / **Configuration**, depending on your layout).
2. Click **Fix configuration** (or open the section that shows “App setting: Add an app icon”).
3. Upload an **app icon**:
   - **Size:** 1200×1200 px  
   - **Format:** PNG or JPEG  
   - **File to use:** `docs/assets/app-icon-1200.png` in this repo (green #008060 with white trend icon, matches your favicon).
4. Save. The “Add an app icon” item should turn into a green checkmark.

If you prefer your own icon: use a 1200×1200 PNG or JPEG, bold colors and simple shape, no text and no Shopify trademarks. [Shopify templates](https://shopify.dev/zip/SubmissionTemplates.zip).

---

## 2. Add an emergency contact

**What’s missing:** “Provide an email and phone number for critical technical matters.”

**What to do:**

1. On the same **Distribution** → **Preliminary steps** page, find **Add an emergency contact for your account**.
2. Click **Fix in settings**.
3. You’ll be taken to **Partners account settings** (or the app’s contact section). Enter:
   - **Email** — one you check regularly (e.g. your support or main contact).
   - **Phone number** — where Shopify can reach you for critical issues.
4. Save. Return to **Distribution** → **Preliminary steps** and confirm the emergency contact item is checked.

---

## 3. Choose a primary listing language

**What’s missing:** “We’ll automatically translate your listing to the most frequently selected languages…”

**What to do:**

1. On **Distribution** → **Preliminary steps**, find **Choose a primary listing language**.
2. Click **Choose**.
3. Select your **primary language** (e.g. **English** if your listing copy is in English).
4. Save. You can add more languages later after the primary listing is published.

---

## 4. Request access to protected customer data (or declare you don’t use it)

**What’s missing:** Either approval to access customer data, or a clear declaration that the app doesn’t use it.

**What to do:**

- **If your app does NOT use protected customer data (recommended if true):**
  1. Find **Request access to protected customer data** on the Preliminary steps page.
  2. Check the box: **“My app won’t use customer data”**.
  3. Save. That item will be marked complete.

  Conversion Optimizer uses **products**, **themes**, and optionally **orders** for scans and recommendations. It does **not** use customer PII (names, emails, addresses) for marketing or profiling. If you only use product/theme/order data for analysis inside the app and don’t access “protected customer data” as defined by Shopify, you can check “My app won’t use customer data.”

- **If your app DOES use customer data** (e.g. you use customer PII for marketing or external systems):
  1. Do **not** check “My app won’t use customer data”.
  2. Follow the flow to **request access to protected customer data** and complete the form. Shopify will review.

---

## Checklist summary

| Step | Action | Where |
|------|--------|--------|
| App icon | Upload `docs/assets/app-icon-1200.png` (1200×1200) | Distribution / Configuration → Fix configuration |
| Emergency contact | Add email + phone | Fix in settings → Account/App settings |
| Primary language | Choose language (e.g. English) | Distribution → Choose |
| Customer data | Check “My app won’t use customer data” or request access | Distribution → same section |

After you complete all four, every **Preliminary steps** item should show a green checkmark.
