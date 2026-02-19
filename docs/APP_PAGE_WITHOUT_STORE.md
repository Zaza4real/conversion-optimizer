# Use your app URL as the app page (no store editing, no password)

You **can’t remove the storefront password** on many Shopify stores because:

- **Development stores** (created from Partners) often **must stay password-protected** until you upgrade or publish. Shopify doesn’t let you turn the password off on some dev stores.
- So **conversionoptimizer.myshopify.com** may stay behind a password no matter what.

You also **don’t need to edit the store**. Your **app backend** already has a professional app page.

---

## Use your app backend URL as the app page

Your app is hosted somewhere (e.g. **Railway**). That URL is your **App URL** in Shopify Partners. When someone visits that URL **without** `?shop=...`, they already see:

- **Conversion Optimizer** heading and short pitch  
- **Get the app** button  
- **What it does** (scan, prioritized list, fixes, export)  
- **3 plans**: Starter $9, Growth $19, Pro $29  
- Second **Get the app** CTA  
- **Privacy** and **Refund** links  

So the **app page** is already live at your backend root.

---

## What to do

1. **Find your app’s public URL**  
   Example: `https://conversion-optimizer-api-production.up.railway.app` (or whatever your Railway/host URL is).

2. **Use that URL everywhere as the app page**
   - In **Partners**, the **App URL** is already this (so the app loads when merchants open it from the Admin).  
   - For **marketing** (social, ads, support), send people to this URL:  
     `https://YOUR-APP-URL/`  
     (no `?shop=`). They’ll see the professional landing page.

3. **Optional: custom domain**  
   If you have a domain (e.g. **getconversionoptimizer.com**), point it to your backend. Then the app page is at that domain.

4. **Ignore the store for the app page**  
   Keep **conversionoptimizer.myshopify.com** as-is (password on, or use it only for testing). You don’t need to paste HTML or remove the password. The **app page** = your backend URL.

---

## Summary

| URL | Use |
|-----|-----|
| **Your backend URL** (e.g. `https://your-app.up.railway.app/`) | **App page** — logo, 3 plans, Install app. Share this. |
| **conversionoptimizer.myshopify.com** | Store; can stay password-protected. Not required for the app page. |

The professional app page is already built and served by your app. Use the backend URL as the app page and you don’t need to change the store or remove the password.
