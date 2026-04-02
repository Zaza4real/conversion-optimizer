import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { ShopsService } from '../shops/shops.service';
export declare class BillingController {
    private readonly billing;
    private readonly config;
    private readonly shops;
    constructor(billing: BillingService, config: ConfigService, shops: ShopsService);
    private needsReconnect;
    status(shop: string | undefined): Promise<{
        subscribed: boolean;
        error: string;
        testMode: boolean;
        upgradeUrl?: undefined;
    } | {
        subscribed: boolean;
        upgradeUrl: string | undefined;
        testMode: boolean;
        error?: undefined;
    }>;
    subscribe(shop: string | undefined, plan: string | undefined, res: Response): Promise<void>;
    return(chargeId: string | undefined, subscriptionId: string | undefined, shop: string | undefined, plan: string | undefined, res: Response): Promise<void>;
    cancel(shop: string | undefined, req: Request, res: Response): Promise<void>;
    private normalizeShop;
    private resolvePlanKey;
    private extractSubscriptionTailId;
}
