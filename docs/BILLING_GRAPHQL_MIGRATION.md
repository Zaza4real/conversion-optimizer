# Billing: GraphQL migration (fix for 422)

## Why we switched

The **REST** endpoint `POST /admin/api/.../recurring_application_charges.json` can return:

```json
422 "It appears that this application is currently owned by a Shop. It must be migrated to the Shopify partners area before it can create charges with the API."
```

This happens for apps created or managed in the **Dev Dashboard** (dev.shopify.com). Shopify is moving billing to the **GraphQL Admin API** only; the REST billing API is legacy and blocked for these apps.

## What we did

- **Create charge:** We now use the **GraphQL** mutation `appSubscriptionCreate` instead of REST `recurring_application_charges`.
- **Confirm after approval:** When the merchant returns from Shopify’s approval page, we confirm the subscription is active via `currentAppInstallation { activeSubscriptions }` and then mark the shop as paid.
- **Return URL:** We still use `/api/billing/return?shop=...`. Shopify may append `charge_id` or `subscription_id`; we accept both.

No change is required in the Dev Dashboard or Railway. Redeploy the backend and try **Subscribe** again; the 422 should be resolved.
