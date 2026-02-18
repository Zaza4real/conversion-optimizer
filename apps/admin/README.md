# Admin app (Next.js + Polaris)

Embedded app in Shopify Admin. Uses App Bridge and session token; all data via our backend API.

Screens: Connect/install, Dashboard (top fixes, experiments), Recommendations list, Apply/diff/rollback, Experiments list and results, Settings (brand voice, autopilot limits, data retention).

Serve with tunnel (e.g. `ngrok` or `cloudflared`) for OAuth callback and embedded load.
