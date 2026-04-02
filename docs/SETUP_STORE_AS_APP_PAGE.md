# Make conversionoptimizer.myshopify.com your app page

Right now that URL shows a password page or a product store. Follow these steps so it shows a **professional app page**: logo, short presentation, 3 plans, and **Install app**.

**Can't remove the password?** Shopify often doesn't allow it on development stores. Use your **app backend URL** as the app page instead (logo, 3 plans, Install app are already there). See **APP_PAGE_WITHOUT_STORE.md**.

---

## 1. Turn off the storefront password

1. **Shopify Admin** → **Online Store** → **Preferences**.
2. In **Password protection**, **uncheck** “Enable password” (or turn it off).
3. **Save**.

Otherwise visitors only see “This store is password protected” and can’t see your app page.

---

## 2. Replace the home page with the app landing HTML

1. Go to **Online Store** → **Themes**.
2. Click **Customize** on your current theme.
3. You’re on the **Home** page. In the left sidebar you’ll see the current sections (e.g. Hero, Products).
4. **Remove** the existing sections:
   - Click each section (Hero, Products, etc.) → click **Remove section**.
5. **Add** the app landing content:
   - Click **Add section**.
   - Choose **Custom liquid** (or **HTML** if your theme has it).
   - Open the file **`docs/conversionoptimizer-store-landing.html`** in this repo.
   - **Before pasting:** replace every `APP_STORE_URL` with your real app install link, e.g.  
     `https://apps.shopify.com/conversion-optimizer`  
     (or your Partners install URL if the app isn’t on the App Store yet.)
   - Copy the **entire** file content and paste it into the Custom liquid block.
6. **Save** (top right).

---

## 3. Optional: use your app’s logo image

The HTML uses an inline SVG logo (green icon + “Conversion Optimizer” text). If you prefer your own image:

- Upload your logo in **Content** → **Files** (or use an external URL).
- In the Custom liquid block, find the `<svg>...</svg>` line and replace it with something like:
  `<img src="https://your-logo-url" alt="Conversion Optimizer" width="48" height="48" style="border-radius:10px">`

---

## 4. Optional: Privacy and Refund links

The footer links to `/pages/privacy` and `/pages/refund`. If you don’t have those pages:

- Create **Pages** in **Content** → **Pages** (e.g. “Privacy”, “Refund”) and paste your policy text, **or**
- Change the links in the pasted HTML to your app’s policy URLs (e.g. `https://your-app-url.up.railway.app/privacy`).

---

## Result

Visiting **https://conversionoptimizer.myshopify.com/** will show:

- Logo and **Conversion Optimizer** name  
- Short presentation line  
- **Install app** button  
- “What it does” (scan, prioritized list, fixes, export)  
- **3 plans**: Starter $9, Growth $19, Pro $29  
- Second **Install app** CTA  
- Footer with Privacy and Refund  

No product catalog, no “Browse our latest products”—just the app page.
