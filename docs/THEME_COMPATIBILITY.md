# Theme compatibility (Conversion Optimizer)

Conversion Optimizer is compatible with all Shopify themes. What you can do depends on your **theme architecture version**. See [Theme architecture versions and sources](https://help.shopify.com/en/manual/online-store/themes/managing-themes/versions#features).

---

## Theme architecture versions (summary)

| Feature | Vintage | Online Store 2.0 | Theme blocks (e.g. Horizon) |
|--------|---------|------------------|-----------------------------|
| Sections on home page | ✔ | ✔ | ✔ |
| Sections on every page (JSON templates) | ✘ | ✔ | ✔ |
| **App blocks & app embeds** | App embeds only | ✔ | ✔ |
| Theme blocks (advanced) | ✘ | ✘ | ✔ |

---

## What works on your theme

### All themes (Vintage, OS 2.0, Theme blocks)

- **Store scan** — We analyze products, trust signals, and theme via the API. The scan runs regardless of theme type.
- **Recommendations** — You get a prioritized list (product fixes, copy, pricing, and suggestions for trust/contact blocks).
- **Product-based fixes** — Titles, descriptions, images, variants, compare-at price, etc. No theme requirement.
- **App embed blocks** — If we add an app embed (e.g. for analytics or a floating element), it works on **Vintage and Online Store 2.0** themes.

### Online Store 2.0 and Theme blocks only

- **App blocks** (e.g. **Trust & Guarantee**, Shipping & Returns, FAQ) — These appear in the **theme editor** only when your theme supports **sections on every page** and **JSON templates**. That means:
  - **Online Store 2.0** themes (e.g. Dawn, many Theme Store themes).
  - **Theme blocks** themes (e.g. Horizon family).
- If a recommendation says “Add a block” (e.g. trust block, contact link), you can:
  - **OS 2.0 / Theme blocks:** Add the block from the theme editor (Online Store → Themes → Customize → product template → Add block → Conversion Optimizer).
  - **Vintage:** Use the same recommendation as a guide and add similar content manually (e.g. a section or custom HTML), or consider upgrading to an [Online Store 2.0 theme](https://themes.shopify.com/) from the Theme Store.

---

## How to check your theme version

1. In **Shopify Admin** go to **Online Store → Themes**.
2. Click **Customize** on your current theme.
3. Open **Products → Default product**.
4. In the sidebar, below the section list, look for **Add section**.
   - **If you see “Add section”** — Your theme supports sections on every page (OS 2.0 or Theme blocks). App blocks from Conversion Optimizer will be available under **Add block** in compatible sections.
   - **If you don’t see “Add section”** — Your theme is likely Vintage. App blocks won’t appear; use recommendations as manual guidance or upgrade to an OS 2.0 theme from the Theme Store.

---

## Extension structure (for developers)

- **App blocks** are in `extensions/theme-extension/blocks/` (e.g. `trust.liquid` with `target: "section"` and `enabled_on` for product/index).
- Schema is defined **inside the Liquid file** with `{% schema %}...{% endschema %}` so the block is valid for the theme editor.
- **shopify.extension.toml** sets `name` and `type = "theme"`. Deploy with Shopify CLI (`shopify app deploy`) so the extension is available to merchants.

---

## References

- [Theme architecture versions and features](https://help.shopify.com/en/manual/online-store/themes/managing-themes/versions#features)
- [Theme app extensions (Shopify dev)](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)
- [App blocks for themes](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#app-blocks-for-themes) — require JSON templates and sections that support `@app` blocks.
