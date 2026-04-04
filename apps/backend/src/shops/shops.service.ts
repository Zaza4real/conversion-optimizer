import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './entities/shop.entity';
import { EncryptionService } from '../common/encryption.service';

/** Env: comma-separated list of shop domains (e.g. store1.myshopify.com,store2.myshopify.com). Max 10 recommended. */
const FREE_BETA_SHOPS_KEY = 'FREE_BETA_SHOPS';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  async findByDomain(domain: string): Promise<Shop | null> {
    return this.shopRepo.findOne({ where: { domain: this.normalizeDomain(domain) } });
  }

  async getById(id: string): Promise<Shop> {
    const shop = await this.shopRepo.findOne({ where: { id } });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async getByDomain(domain: string): Promise<Shop> {
    const shop = await this.findByDomain(domain);
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async upsertWithToken(domain: string, accessToken: string, scope?: string): Promise<{ shop: Shop; wasUninstalled: boolean; isNew: boolean }> {
    const normalized = this.normalizeDomain(domain);
    const encrypted = this.encryption.encrypt(accessToken);
    let shop = await this.findByDomain(normalized);
    if (shop) {
      const wasUninstalled = shop.uninstalledAt != null;
      shop.accessTokenEnc = encrypted;
      shop.scope = scope ?? shop.scope;
      if (wasUninstalled && shop.uninstalledAt) {
        // Persist the uninstall time in settings before clearing the column
        // so auth callback can detect reinstall even if webhook fires after OAuth
        shop.settings = {
          ...(shop.settings ?? {}),
          lastUninstalledAt: shop.uninstalledAt.toISOString(),
        };
      }
      shop.uninstalledAt = null;
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
      return { shop, wasUninstalled, isNew: false };
    }
    shop = this.shopRepo.create({
      domain: normalized,
      accessTokenEnc: encrypted,
      scope: scope ?? null,
      plan: 'free',
      settings: {},
    });
    await this.shopRepo.save(shop);
    return { shop, wasUninstalled: false, isNew: true };
  }

  /** Clear the lastUninstalledAt flag after we've used it (e.g., shown welcome_back). */
  async clearLastUninstalledAt(domain: string): Promise<void> {
    const shop = await this.findByDomain(this.normalizeDomain(domain));
    if (shop && (shop.settings ?? {})['lastUninstalledAt']) {
      const s = { ...(shop.settings ?? {}) };
      delete s['lastUninstalledAt'];
      shop.settings = s;
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  getAccessToken(shop: Shop): string {
    return this.encryption.decrypt(shop.accessTokenEnc);
  }

  async markUninstalled(domain: string): Promise<void> {
    const shop = await this.findByDomain(domain);
    if (shop) {
      shop.uninstalledAt = new Date();
      shop.settings = {
        ...(shop.settings ?? {}),
        lastUninstalledAt: shop.uninstalledAt.toISOString(),
      };
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  /** Mark shop as paid and store the recurring charge id and plan tier. */
  async setPaidPlan(
    domain: string,
    recurringChargeId: string,
    plan: 'starter' | 'growth' | 'pro' | 'pro_annual' = 'growth',
    options?: { currentPeriodEndIso?: string | null },
  ): Promise<void> {
    const shop = await this.findByDomain(this.normalizeDomain(domain));
    if (shop) {
      shop.plan = plan;
      shop.recurringChargeId = recurringChargeId;
      const merged: Record<string, unknown> = {
        ...(shop.settings ?? {}),
        billingGraceUntil: null,
        cancelledPlanLabel: null,
      };
      const iso = options?.currentPeriodEndIso != null ? String(options.currentPeriodEndIso).trim() : '';
      if (iso) {
        merged['billingPeriodEndIso'] = iso;
      }
      shop.settings = merged;
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  /** Clear billing when subscription is cancelled. */
  async clearBilling(domain: string, billingGraceUntil?: string | null, cancelledPlanLabel?: string | null): Promise<void> {
    const shop = await this.findByDomain(this.normalizeDomain(domain));
    if (shop) {
      shop.plan = 'free';
      shop.recurringChargeId = null;
      shop.settings = {
        ...(shop.settings ?? {}),
        billingGraceUntil: billingGraceUntil ?? null,
        cancelledPlanLabel: cancelledPlanLabel ?? null,
        billingPeriodEndIso: null,
      };
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  /** True if shop is on the free beta allowlist (full access, no charge). */
  isFreeBetaShop(domain: string): boolean {
    const raw = this.config.get<string>(FREE_BETA_SHOPS_KEY) ?? process.env[FREE_BETA_SHOPS_KEY] ?? '';
    if (!raw.trim()) return false;
    const normalized = this.normalizeDomain(domain);
    const list = raw.split(',').map((d) => this.normalizeDomain(d)).filter(Boolean);
    return list.includes(normalized);
  }

  /** True if shop has an active paid subscription (any tier) or is on the free beta allowlist. */
  hasPaidPlan(shop: Shop): boolean {
    if (this.isFreeBetaShop(shop.domain)) return true;
    const paid = shop.plan === 'starter' || shop.plan === 'growth' || shop.plan === 'pro' || shop.plan === 'pro_annual' || shop.plan === 'paid';
    if (paid && shop.recurringChargeId != null) return true;
    const graceUntil = this.getBillingGraceUntil(shop);
    if (!graceUntil) return false;
    const graceDate = new Date(graceUntil);
    return !Number.isNaN(graceDate.getTime()) && graceDate.getTime() > Date.now();
  }

  /** Current plan label for display (e.g. "Starter", "Growth", "Pro", "Free beta"). */
  getPlanLabel(shop: Shop): string {
    if (this.isFreeBetaShop(shop.domain)) return 'Free beta';
    if (shop.plan === 'free') {
      const cancelledLabel = this.getCancelledPlanLabel(shop);
      if (cancelledLabel) return cancelledLabel;
    }
    if (shop.plan === 'pro_annual') return 'Pro Annual';
    if (shop.plan === 'pro') return 'Pro';
    if (shop.plan === 'growth' || shop.plan === 'paid') return 'Growth';
    if (shop.plan === 'starter') return 'Starter';
    return 'Free';
  }

  /**
   * True when the merchant already cancelled: future grace/period window OR free plan with a
   * stored cancelled label. Also treats a paid plan with NO recurringChargeId as cancelled (can
   * happen when Shopify sync re-sets plan but our clearBilling call already wiped the charge id).
   * Used to skip Shopify sync overwrites and to disable the Cancel control in the UI.
   */
  isBillingCancelledPending(shop: Shop): boolean {
    // Explicit grace period from cancel flow
    const grace = this.getBillingGraceUntil(shop);
    if (grace?.trim()) {
      const d = new Date(grace);
      if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) return true;
    }
    // Free plan with a saved cancelled label
    if (shop.plan === 'free' && this.getCancelledPlanLabel(shop)?.trim()) return true;
    // Paid plan tier but no active charge id — subscription was cleared but plan label lingers
    const paidPlan = shop.plan === 'starter' || shop.plan === 'growth' || shop.plan === 'pro' || shop.plan === 'pro_annual';
    if (paidPlan && !shop.recurringChargeId?.trim()) {
      const periodEnd = this.getBillingPeriodEnd(shop);
      if (periodEnd?.trim()) {
        const d = new Date(periodEnd);
        if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) return true;
      }
    }
    return false;
  }

  getBillingGraceUntil(shop: Shop): string | null {
    const raw = (shop.settings ?? {})['billingGraceUntil'];
    return typeof raw === 'string' && raw.trim() ? raw : null;
  }

  getCancelledPlanLabel(shop: Shop): string | null {
    const raw = (shop.settings ?? {})['cancelledPlanLabel'];
    return typeof raw === 'string' && raw.trim() ? raw : null;
  }

  /** Repair-only: set cancelledPlanLabel in settings without changing plan/grace/token. */
  async repairCancelledPlanLabel(domain: string, label: string): Promise<void> {
    const shop = await this.findByDomain(this.normalizeDomain(domain));
    if (shop) {
      shop.settings = { ...(shop.settings ?? {}), cancelledPlanLabel: label };
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  /** Last known subscription period end from Shopify (persisted when the API returns it). */
  getBillingPeriodEnd(shop: Shop): string | null {
    const raw = (shop.settings ?? {})['billingPeriodEndIso'];
    return typeof raw === 'string' && raw.trim() ? raw : null;
  }

  /** Merge period end into settings without touching plan, grace, or tokens (reinstall / banner backfill). */
  async mergeBillingPeriodEndIso(domain: string, iso: string): Promise<void> {
    const shop = await this.findByDomain(this.normalizeDomain(domain));
    if (!shop || !iso?.trim()) return;
    shop.settings = { ...(shop.settings ?? {}), billingPeriodEndIso: iso.trim() };
    shop.updatedAt = new Date();
    await this.shopRepo.save(shop);
  }

  async findByRecurringChargeId(chargeId: string): Promise<Shop | null> {
    return this.shopRepo.findOne({
      where: { recurringChargeId: String(chargeId) },
    });
  }

  /** Remove the shop so the next app load forces fresh OAuth (fixes stale/wrong token). */
  async deleteByDomain(domain: string): Promise<boolean> {
    const normalized = this.normalizeDomain(domain);
    const result = await this.shopRepo.delete({ domain: normalized });
    return (result.affected ?? 0) > 0;
  }

  private normalizeDomain(domain: string): string {
    const d = domain.toLowerCase().trim();
    return d.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
  }
}
