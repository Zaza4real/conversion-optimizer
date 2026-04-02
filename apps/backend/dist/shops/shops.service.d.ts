import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Shop } from './entities/shop.entity';
import { EncryptionService } from '../common/encryption.service';
export declare class ShopsService {
    private readonly shopRepo;
    private readonly encryption;
    private readonly config;
    constructor(shopRepo: Repository<Shop>, encryption: EncryptionService, config: ConfigService);
    findByDomain(domain: string): Promise<Shop | null>;
    getById(id: string): Promise<Shop>;
    getByDomain(domain: string): Promise<Shop>;
    upsertWithToken(domain: string, accessToken: string, scope?: string): Promise<Shop>;
    getAccessToken(shop: Shop): string;
    markUninstalled(domain: string): Promise<void>;
    setPaidPlan(domain: string, recurringChargeId: string, plan?: 'starter' | 'growth' | 'pro' | 'pro_annual', options?: {
        currentPeriodEndIso?: string | null;
    }): Promise<void>;
    clearBilling(domain: string, billingGraceUntil?: string | null, cancelledPlanLabel?: string | null): Promise<void>;
    isFreeBetaShop(domain: string): boolean;
    hasPaidPlan(shop: Shop): boolean;
    getPlanLabel(shop: Shop): string;
    getBillingGraceUntil(shop: Shop): string | null;
    getCancelledPlanLabel(shop: Shop): string | null;
    repairCancelledPlanLabel(domain: string, label: string): Promise<void>;
    getBillingPeriodEnd(shop: Shop): string | null;
    findByRecurringChargeId(chargeId: string): Promise<Shop | null>;
    deleteByDomain(domain: string): Promise<boolean>;
    private normalizeDomain;
}
