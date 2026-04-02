import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ShopsService } from '../shops/shops.service';
import { ShopifyApiService } from '../shopify/shopify-api.service';
import { Recommendation } from '../recommendations/entities/recommendation.entity';
export declare const SCAN_QUEUE = "scan";
export interface ScanJobPayload {
    shopId: string;
}
export declare class ScanProcessor extends WorkerHost {
    private readonly recRepo;
    private readonly shops;
    private readonly shopify;
    constructor(recRepo: Repository<Recommendation>, shops: ShopsService, shopify: ShopifyApiService);
    process(job: Job<ScanJobPayload>): Promise<{
        recommendationsCreated: number;
    }>;
}
