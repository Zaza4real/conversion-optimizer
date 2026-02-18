# Railway Variables – match these (same as .env)

Set these on **conversion-optimizer-api** → **Variables** so they match your Dev Dashboard app and local `.env`.

| Variable | Value |
|----------|--------|
| **SHOPIFY_API_KEY** | Client ID from Dev Dashboard → your app → Settings |
| **SHOPIFY_API_SECRET** | Secret from Dev Dashboard → your app → Settings |
| **SHOPIFY_APP_URL** | `https://conversion-optimizer-api-production.up.railway.app` |

After changing Variables, save and let Railway redeploy. Then clear the shop (forget URL or `DELETE FROM shops`) and open the app from Shopify Admin so a new token is saved for this app.
