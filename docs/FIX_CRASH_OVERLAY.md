# Fix: "Crash" message and loading overlay stuck on screen

## What you might see

- Shopify Admin shows a **"Something went wrong"** or **"App crashed"** (or "taking a while to load") message.
- A **loading overlay** stays on the screen even though the app has loaded and there was no real crash.

## Why it happens

When the app is embedded in the Shopify Admin iframe, **Shopify shows a loading overlay** until the app tells it the page is ready. If the app never calls the App Bridge **Loading API** to hide that overlay, it can stay visible and then turn into a "crash" or "taking a while to load" message even when the app is actually fine.

## What we changed

The app now **dismisses the loading overlay** as soon as each page is ready by calling `shopify.loading(false)` in a small script on:

- App home
- Billing confirm and cancel-confirm
- Scan run page
- Recommendations page

So the overlay should disappear and you should see the app content without a false "crash" message.

## If it still happens

1. **Check App URL and embedding**  
   In Partners → App setup, the **App URL** must match your backend (e.g. Railway) and the app must be set to **embedded**. Wrong URL or non-embedded can cause iframe/loading issues.

2. **Check API key**  
   `SHOPIFY_API_KEY` must be set on the backend so the `<meta name="shopify-api-key">` tag is correct. Missing or wrong key can prevent App Bridge from initializing and hide the loading bar.

3. **Open the app in a new tab**  
   Try opening the app’s URL in a new tab (with `?shop=your-store.myshopify.com`). If it loads there but not in the iframe, the problem is likely **Content Security Policy** (e.g. `frame-ancestors`) or embedding config in Partners.

4. **Browser console**  
   In the iframe (right‑click → Inspect, or open DevTools and select the app iframe), check the Console for errors. "shopify is not defined" or script errors can prevent the loading bar from being dismissed.

## Summary

The backend now calls App Bridge’s loading API so the Admin loading overlay is hidden when the app is ready. Deploy the latest backend and retry; the false "crash" and stuck overlay should stop for normal loads.
