import { Injectable } from '@nestjs/common';
import { GET_PRODUCTS_PAGE } from './graphql/products.queries';
import { GET_THEMES } from './graphql/themes.queries';

const ADMIN_GRAPHQL = '/admin/api/2024-01/graphql.json';

export interface ProductNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  options?: { name: string; values: string[] }[];
  variants: { edges: { node: { id: string; title: string; price: string; compareAtPrice?: string; availableForSale: boolean } }[] };
  images: { edges: { node: { id: string; url: string; altText?: string; width?: number; height?: number } }[] };
  metafields?: { edges: { node: { key: string; value: string } }[] };
}

export interface ThemeNode {
  id: string;
  name: string;
  role: string;
}

@Injectable()
export class ShopifyApiService {
  async graphql<T>(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `https://${shop}${ADMIN_GRAPHQL}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    return json.data as T;
  }

  async *fetchProducts(shop: string, accessToken: string, maxPages = 10): AsyncGenerator<ProductNode[]> {
    let cursor: string | null = null;
    const first = 50;
    type ProductsRes = { products: { pageInfo: { hasNextPage: boolean; endCursor: string }; edges: { node: ProductNode }[] } };
    for (let page = 0; page < maxPages; page++) {
      const data: ProductsRes = await this.graphql<ProductsRes>(shop, accessToken, GET_PRODUCTS_PAGE, { first, after: cursor });
      const nodes = data.products.edges.map((e: { node: ProductNode }) => e.node);
      if (nodes.length === 0) break;
      yield nodes;
      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor;
    }
  }

  async getThemes(shop: string, accessToken: string): Promise<ThemeNode[]> {
    const data = await this.graphql<{ themes: { edges: { node: ThemeNode }[] } }>(shop, accessToken, GET_THEMES);
    return data.themes.edges.map((e) => e.node);
  }
}
