"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopifyApiService = void 0;
const common_1 = require("@nestjs/common");
const products_queries_1 = require("./graphql/products.queries");
const themes_queries_1 = require("./graphql/themes.queries");
const ADMIN_GRAPHQL = '/admin/api/2024-01/graphql.json';
let ShopifyApiService = class ShopifyApiService {
    async graphql(shop, accessToken, query, variables) {
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
            console.error('[Shopify API]', res.status, text.slice(0, 500));
            throw new Error('Shopify API request failed. Please try again.');
        }
        const json = await res.json();
        if (json.errors?.length) {
            console.error('[Shopify API] GraphQL errors', JSON.stringify(json.errors).slice(0, 500));
            throw new Error('Shopify API request failed. Please try again.');
        }
        return json.data;
    }
    async *fetchProducts(shop, accessToken, maxPages = 10) {
        let cursor = null;
        const first = 50;
        for (let page = 0; page < maxPages; page++) {
            const data = await this.graphql(shop, accessToken, products_queries_1.GET_PRODUCTS_PAGE, { first, after: cursor });
            const nodes = data.products.edges.map((e) => e.node);
            if (nodes.length === 0)
                break;
            yield nodes;
            if (!data.products.pageInfo.hasNextPage)
                break;
            cursor = data.products.pageInfo.endCursor;
        }
    }
    async getThemes(shop, accessToken) {
        const data = await this.graphql(shop, accessToken, themes_queries_1.GET_THEMES);
        return data.themes.edges.map((e) => e.node);
    }
};
exports.ShopifyApiService = ShopifyApiService;
exports.ShopifyApiService = ShopifyApiService = __decorate([
    (0, common_1.Injectable)()
], ShopifyApiService);
