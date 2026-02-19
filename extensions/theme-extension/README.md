# Theme App Extension

App blocks (e.g. Trust & Guarantee) for **Online Store 2.0** themes. Compatible with themes that support sections on every page and JSON templates. See [Theme compatibility](../../docs/THEME_COMPATIBILITY.md).

- **Blocks:** Trust/Guarantee (implemented); Shipping & Returns, FAQ, Urgency/Stock, Social proof (planned). Each block uses `{% schema %}` inside the Liquid file with `target: "section"` and `enabled_on` templates.
- **App embed:** Optional minimal JS for experiments (not required for scan/recommendations).
- **Config:** Block settings in the theme editor. No raw theme edits; merchant adds blocks from Customize → product/page template → Add block → Conversion Optimizer.

**Vintage themes:** App blocks do not appear in the theme editor. Merchants can follow recommendations manually or switch to an [OS 2.0 theme](https://themes.shopify.com/) from the Theme Store.
