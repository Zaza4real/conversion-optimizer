import { ProductCache } from '../../products-cache/entities/product-cache.entity';
import { Recommendation } from '../../recommendations/entities/recommendation.entity';
export declare class Shop {
    id: string;
    domain: string;
    accessTokenEnc: Buffer;
    scope: string | null;
    plan: string;
    recurringChargeId: string | null;
    installedAt: Date;
    updatedAt: Date;
    settings: Record<string, unknown>;
    uninstalledAt: Date | null;
    productsCache?: ProductCache[];
    recommendations?: Recommendation[];
}
