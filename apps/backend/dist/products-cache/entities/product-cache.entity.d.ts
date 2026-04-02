import { Shop } from '../../shops/entities/shop.entity';
export declare class ProductCache {
    id: string;
    shopId: string;
    productId: string;
    handle: string;
    data: Record<string, unknown>;
    updatedAt: Date;
    shop: Shop;
}
