import { Request } from 'express';
import { RecommendationsService } from './recommendations.service';
import { REQUEST_SHOP_KEY } from '../billing/guards/paid-plan.guard';
import type { Shop } from '../shops/entities/shop.entity';
export declare class RecommendationsController {
    private readonly recommendations;
    constructor(recommendations: RecommendationsService);
    list(req: Request & {
        [REQUEST_SHOP_KEY]?: Shop;
    }, _shopDomain: string, limit?: string): Promise<{
        id: string;
        category: string;
        severity: string;
        rationale: string;
        expectedImpact: {
            metric?: string;
            low?: number;
            high?: number;
        } | undefined;
        title: string;
        appliesTo: string;
        issueDetail: string | undefined;
        targetUrl: string | undefined;
    }[]>;
}
