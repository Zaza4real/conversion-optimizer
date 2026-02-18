# Admin app (Next.js + Polaris)

Embedded app in Shopify Admin. Uses Polaris and our backend API.

## Screens

- **Dashboard** (`/`) — Billing status and upgrade CTA when not subscribed.
- **Upgrade** (`/upgrade?shop=...`) — Plan and pricing ($19/month), “Subscribe” CTA, and value copy.

## Setup

1. **API URL** — Set `NEXT_PUBLIC_API_URL` to your backend (e.g. Railway URL), e.g. `https://conversion-optimizer-api-production.up.railway.app`. Required so the admin can call billing and scan APIs.
2. **Shopify API key** (optional, for embedded) — Set `NEXT_PUBLIC_SHOPIFY_API_KEY` if you use App Bridge in embedded mode.
3. Run: `pnpm install && pnpm dev`. Use a tunnel (e.g. ngrok) and point your Shopify app’s “App URL” to the tunnel (or to the same host as your backend) so the admin loads in the iframe.

## Billing flow

- Dashboard and Upgrade page call `GET /api/billing/status?shop=...`. If not subscribed, they show an upgrade banner and a “Subscribe for $19/month” CTA.
- The CTA links to `{NEXT_PUBLIC_API_URL}/api/billing/subscribe?shop=...`, which creates the charge and redirects the merchant to Shopify’s confirmation. After approval, the backend marks the shop as paid and redirects back.
