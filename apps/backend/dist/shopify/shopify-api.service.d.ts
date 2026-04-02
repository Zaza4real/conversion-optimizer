export interface ProductNode {
    id: string;
    title: string;
    handle: string;
    descriptionHtml: string;
    productType: string;
    options?: {
        name: string;
        values: string[];
    }[];
    variants: {
        edges: {
            node: {
                id: string;
                title: string;
                price: string;
                compareAtPrice?: string;
                availableForSale: boolean;
            };
        }[];
    };
    images: {
        edges: {
            node: {
                id: string;
                url: string;
                altText?: string;
                width?: number;
                height?: number;
            };
        }[];
    };
    metafields?: {
        edges: {
            node: {
                key: string;
                value: string;
            };
        }[];
    };
}
export interface ThemeNode {
    id: string;
    name: string;
    role: string;
}
export declare class ShopifyApiService {
    graphql<T>(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>): Promise<T>;
    fetchProducts(shop: string, accessToken: string, maxPages?: number): AsyncGenerator<ProductNode[]>;
    getThemes(shop: string, accessToken: string): Promise<ThemeNode[]>;
}
