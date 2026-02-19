# How to customize your Shopify store landing page

You're pasting the app landing HTML into **Custom liquid** on the home page. Here’s how to customize it without breaking the layout.

---

## 1. Before you paste

- **Replace `APP_STORE_URL`** (appears twice in the file) with your real install link, e.g.  
  `https://apps.shopify.com/conversion-optimizer`  
  Use your browser’s Find (Ctrl+F / Cmd+F) to replace all.
- **Optional:** Change the footer links. The file uses `/pages/privacy` and `/pages/refund`. If your policies live elsewhere, edit those `href` values in the footer.

---

## 2. Change the logo

**Option A — Keep the SVG icon, change the text**  
Find the line with `Conversion Optimizer` (next to the green icon) and edit the text. The icon is the `<svg>...</svg>` block; leave it as-is or replace the whole block with an image.

**Option B — Use your own logo image**  
1. Upload your logo: **Content** → **Files** → **Upload**, or use an external URL.  
2. In the HTML, find the logo block (the `<div>` with the SVG and “Conversion Optimizer” text).  
3. Replace the **entire** `<div style="display:inline-flex;...">...</div>` with something like:

```html
<div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:24px;">
  <img src="https://your-logo-url-here.com/logo.png" alt="Conversion Optimizer" width="48" height="48" style="border-radius:10px;">
  <span style="font-size:26px;font-weight:700;letter-spacing:-0.03em;color:#0d0d0d;">Conversion Optimizer</span>
</div>
```

Use your real image URL. For a file you uploaded in Shopify, use the file’s URL from the Files page.

---

## 3. Change colors

The main green is **`#00664f`**. To change it:

- In the HTML, use Find & Replace: replace **`#00664f`** with your hex color (e.g. `#0d9488` for teal, `#1e40af` for blue).
- It’s used for: buttons, plan prices, footer links, and the Growth plan border. Replacing all at once keeps the look consistent.

---

## 4. Edit the copy (headline, pitch, features, plans)

- **Hero tagline** — Find the `<p>` right under the logo that starts with “The app that analyzes…” and edit the text. Keep it to one or two short sentences.
- **What it does** — Edit the `<h2>`, the paragraph, and the `<li>` items in that section. Add or remove bullets as needed.
- **Plans** — Each plan is in its own `<div>`. Edit the plan name, price (e.g. `$9`), `/mo`, and the description paragraph. To highlight a different plan, add `border:2px solid #00664f` and a light background to that plan’s `<div>` (like the Growth plan in the file).
- **Bottom CTA** — Edit the “Ready to fix your store?” and the line under it. The button link is the same `APP_STORE_URL` you already replaced.

---

## 5. Add or remove a section

- **Add a section** — Copy an existing `<section>...</section>` block, paste it above or below another, then change the heading and content inside.
- **Remove a section** — Delete the whole `<section>...</section>` (from `<section` to `</section>`). For example, you can remove “What it does” if you want only logo, pitch, plans, and CTA.

---

## 6. Theme header and footer

The HTML is just the **main content**. The store’s **theme** still adds:

- **Header** (nav, logo, cart). To simplify: **Theme settings** (in the left sidebar when customizing) → **Header** → reduce links or hide the cart if this is an app landing only.
- **Footer** — Your pasted block has its own small footer (Privacy | Refund). You can hide the theme footer for the home page: **Theme settings** → **Footer** → disable or minimize.

So “customize” = your HTML block + theme header/footer settings.

---

## 7. Mobile

The layout uses simple flex and grid with `minmax(180px, 1fr)` so the three plans stack on small screens. If something looks off on mobile:

- Reduce padding: change `padding:40px 20px 60px` (on the outer `div`) to e.g. `padding:24px 16px 48px`.
- Slightly smaller heading: find `font-size:26px` next to “Conversion Optimizer” and try `font-size:22px` for mobile only (you’d need a media query; if your theme doesn’t support that in Custom liquid, one smaller size for all is fine).

---

## 8. Preview before publishing

After editing the Custom liquid block, use **Preview** (or open the store in a new tab) to check:

- Both **Install app** buttons go to the right URL.
- Logo and text look right on desktop and phone.
- Plan prices and copy are correct.

Then hit **Save** in the theme editor.

---

## Quick reference

| What to change      | Where in the HTML                          |
|---------------------|--------------------------------------------|
| Install link        | Replace `APP_STORE_URL` (2 places)         |
| Logo                | The `<div>` with SVG + “Conversion Optimizer” |
| Hero tagline        | The `<p>` under the logo                   |
| Features list       | The `<ul>` under “What it does”            |
| Plan names/prices   | The three `<div class="plan">` blocks       |
| Main green color    | Find & replace `#00664f`                   |
| Privacy/Refund links| Footer `<a href="...">`                    |

If you tell me what you want to change first (e.g. “different headline” or “blue instead of green”), I can give you the exact snippet to paste in.
