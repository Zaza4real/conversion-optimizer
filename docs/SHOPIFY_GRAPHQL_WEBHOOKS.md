# Shopify GraphQL and webhooks

## 1. OAuth scopes

**Default (read-only):**  
`read_products`, `read_orders`, `read_themes`

**Optional (when merchant enables “Apply changes directly”):**  
`write_products` (for title/description/metafields updates)

We do **not** request `write_themes` or theme asset access. All storefront changes go through Theme App Extension.

---

## 2. Key Admin API GraphQL operations

### Products (for cache and scan)

```graphql
query GetProducts($first: Int!, $after: String, $query: String) {
  products(first: $first, after: $after, query: $query) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        title
        handle
        descriptionHtml
        productType
        options { name values }
        variants(first: 50) {
          edges {
            node {
              id
              title
              price
              compareAtPrice
              availableForSale
              selectedOptions { name value }
            }
          }
        }
        images(first: 20) {
          edges {
            node {
              id
              url
              altText
              width
              height
            }
          }
        }
        metafields(first: 20, namespace: "conversion_optimizer") {
          edges { node { key value } }
        }
      }
    }
  }
}
```

### Single product (for recommendation context and patch apply)

```graphql
query GetProduct($id: ID!) {
  product(id: $id) {
    id
    title
    handle
    descriptionHtml
    variants(first: 100) { edges { node { id title price compareAtPrice availableForSale } } }
    images(first: 30) { edges { node { id url altText width height } } }
    metafields(first: 30, namespace: "conversion_optimizer") { edges { node { key value } } }
  }
}
```

### Orders (for cache and conversion/revenue)

```graphql
query GetOrders($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        name
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount } }
        lineItems(first: 50) { edges { node { id quantity } } }
        createdAt
        sourceName
        landingSite
        referringSite
      }
    }
  }
}
```

### Themes (active theme and extension config)

```graphql
query GetThemes {
  themes(first: 10) {
    edges {
      node {
        id
        name
        role
      }
    }
  }
}

query GetTheme($id: ID!) {
  theme(id: $id) {
    id
    name
    role
  }
}
```

We don’t fetch raw Liquid; we only need to know active theme id/name. Theme App Extension is installed at app level, not per-theme.

### Metafields (app state, experiment flags)

**Namespace:** `conversion_optimizer`

Read (via AppInstallation or Shop):

```graphql
query GetAppMetafields {
  shop {
    id
    metafields(first: 50, namespace: "conversion_optimizer") {
      edges { node { key value type } }
    }
  }
}
```

Write (when we have write scope; prefer app-owned metafields):

```graphql
mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key value }
    userErrors { field message }
  }
}
```

Input example: `{ ownerId: "gid://shopify/Shop/<id>", namespace: "conversion_optimizer", key: "experiment_assignments", type: "json", value: "{\"exp_1\":\"control\"}" }`.  
For v1 we may keep experiment assignment in Redis + pixel cookie only; metafields for “last scan at”, “patch version” etc.

### App installation (optional: check scopes)

```graphql
query GetAppInstallation {
  currentAppInstallation {
    id
    launchUrl
    metafields(first: 20, namespace: "conversion_optimizer") { edges { node { key value } } }
  }
}
```

---

## 3. Mutations (only when write enabled)

### Product update (title, description, metafields)

```graphql
mutation UpdateProduct($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title descriptionHtml }
    userErrors { field message }
  }
}
```

```graphql
mutation SetProductMetafield($input: MetafieldsSetInput!) {
  metafieldsSet(metafields: [$input]) {
    metafields { id key value }
    userErrors { field message }
  }
}
```

We use these for “apply to product” patches (copy, bullets in metafield). Theme blocks stay in extension config.

---

## 4. Webhooks (idempotent, HMAC verified)

All endpoints: `POST /webhooks/shopify/:topic`. Verify `X-Shopify-Hmac-SHA256` with shared secret; reject if invalid. Parse body (JSON); use idempotency key to avoid double processing.

| Topic | Handler | Idempotency | Action |
|-------|---------|-------------|--------|
| APP_UNINSTALLED | Mark shop uninstalled, schedule data purge | shop domain | Set `shops.uninstalled_at`; queue delete job |
| PRODUCTS_CREATE | Invalidate / upsert product cache | shop_id + product id | Upsert `products_cache` |
| PRODUCTS_UPDATE | Same | shop_id + product id | Upsert `products_cache` |
| PRODUCTS_DELETE | Remove from cache | shop_id + product id | Delete from `products_cache` |
| ORDERS_CREATE | Ingest order for revenue/attribution | shop_id + order id | Upsert `orders_cache`; optionally link to experiment |
| ORDERS_UPDATED | Same | shop_id + order id | Upsert `orders_cache` |
| THEMES_PUBLISH | Invalidate theme cache / rescan flag | shop_id + theme id | Set “theme changed” flag; optional rescan |
| SHOP_UPDATE | Update shop settings if needed | shop domain | Update `shops.updated_at`, optional fields |

Idempotency: store `webhook_id` (from header) or `(topic, entity_id)` in Redis with TTL (e.g. 24h); skip if already seen. Alternatively use DB table `webhook_events(webhook_id, topic, processed_at)`.

---

## 5. File layout (backend)

- `src/shopify/graphql/queries/products.gql.ts` — product queries
- `src/shopify/graphql/queries/orders.gql.ts`
- `src/shopify/graphql/queries/themes.gql.ts`
- `src/shopify/graphql/mutations/products.gql.ts`
- `src/shopify/webhooks/webhooks.controller.ts` — POST handler, HMAC check
- `src/shopify/webhooks/handlers/*.ts` — per-topic handler (enqueue job or inline if fast)
