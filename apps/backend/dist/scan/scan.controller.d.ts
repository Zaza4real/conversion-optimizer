import { Request } from 'express';
import { ScanService } from './scan.service';
import { REQUEST_SHOP_KEY } from '../billing/guards/paid-plan.guard';
import type { Shop } from '../shops/entities/shop.entity';
export declare class ScanController {
    private readonly scan;
    constructor(scan: ScanService);
    start(req: Request & {
        [REQUEST_SHOP_KEY]?: Shop;
    }): Promise<{
        jobId: string;
    }>;
    jobStatus(jobId: string): Promise<{
        status: string;
        result?: unknown;
    }>;
}
