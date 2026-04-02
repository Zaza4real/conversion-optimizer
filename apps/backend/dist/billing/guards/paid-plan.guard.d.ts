import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ShopsService } from '../../shops/shops.service';
export declare const PAID_PLAN_SKIP = "paid_plan_skip";
export declare const REQUEST_SHOP_KEY = "conversionOptimizerShop";
export declare const SkipPaidPlan: () => import("@nestjs/common").CustomDecorator<string>;
export declare class PaidPlanGuard implements CanActivate {
    private readonly shops;
    private readonly reflector;
    constructor(shops: ShopsService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
