import { Shop } from '../../shops/entities/shop.entity';
export declare class Recommendation {
    id: string;
    shopId: string;
    entityType: string;
    entityId: string;
    category: string;
    ruleId: string;
    severity: string;
    rationale: string;
    expectedImpact: {
        metric?: string;
        low?: number;
        high?: number;
    } | null;
    patchPayload: Record<string, unknown> | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    shop: Shop;
}
