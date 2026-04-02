import { ConfigService } from '@nestjs/config';
import { ShopsService } from '../shops/shops.service';
export declare const PLANS: {
    readonly starter: {
        readonly price: 9;
        readonly interval: "EVERY_30_DAYS";
        readonly name: "Conversion Optimizer — Starter $9/month";
        readonly key: "starter";
    };
    readonly growth: {
        readonly price: 19;
        readonly interval: "EVERY_30_DAYS";
        readonly name: "Conversion Optimizer — Growth $19/month";
        readonly key: "growth";
    };
    readonly pro: {
        readonly price: 29;
        readonly interval: "EVERY_30_DAYS";
        readonly name: "Conversion Optimizer — Pro $29/month";
        readonly key: "pro";
    };
    readonly pro_annual: {
        readonly price: 290;
        readonly interval: "ANNUAL";
        readonly name: "Conversion Optimizer — Pro $290/year";
        readonly key: "pro_annual";
    };
};
export type PlanKey = keyof typeof PLANS;
export interface CreateChargeResult {
    confirmationUrl: string;
    chargeId: number;
}
export interface ChargeStatus {
    id: number;
    status: string;
    name: string;
    price: string;
}
export interface ActiveSubscriptionInfo {
    id: string;
    planKey: PlanKey;
    planLabel: string;
    status: string;
    currentPeriodEnd: string | null;
}
export interface CancelSubscriptionResult {
    currentPeriodEnd: string | null;
    planLabel: string;
}
export declare class BillingService {
    private readonly config;
    private readonly shops;
    constructor(config: ConfigService, shops: ShopsService);
    private throwReconnectRequired;
    createRecurringCharge(shopDomain: string, planKey?: PlanKey): Promise<CreateChargeResult>;
    confirmAndActivate(shopDomain: string, chargeId: string, planKey?: PlanKey): Promise<void>;
    private parseSubscriptionId;
    private tryReturnGraceOnlyCancel;
    private fetchAppSubscriptionStatusByGid;
    cancelSubscription(shopDomain: string): Promise<CancelSubscriptionResult>;
    getActiveSubscriptionInfo(shopDomain: string): Promise<ActiveSubscriptionInfo | null>;
    private getActiveSubscriptionSnapshots;
    private pickPreferredActiveSubscription;
    private resolvePlanFromSnapshot;
    private normalizeDomain;
}
