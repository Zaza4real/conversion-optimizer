import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './entities/shop.entity';
import { EncryptionService } from '../common/encryption.service';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    private readonly encryption: EncryptionService,
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

  async upsertWithToken(domain: string, accessToken: string, scope?: string): Promise<Shop> {
    const normalized = this.normalizeDomain(domain);
    const encrypted = this.encryption.encrypt(accessToken);
    let shop = await this.findByDomain(normalized);
    if (shop) {
      shop.accessTokenEnc = encrypted;
      shop.scope = scope ?? shop.scope;
      shop.uninstalledAt = null;
      shop.updatedAt = new Date();
      return this.shopRepo.save(shop);
    }
    shop = this.shopRepo.create({
      domain: normalized,
      accessTokenEnc: encrypted,
      scope: scope ?? null,
      plan: 'free',
      settings: {},
    });
    return this.shopRepo.save(shop);
  }

  getAccessToken(shop: Shop): string {
    return this.encryption.decrypt(shop.accessTokenEnc);
  }

  async markUninstalled(domain: string): Promise<void> {
    const shop = await this.findByDomain(domain);
    if (shop) {
      shop.uninstalledAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  /** Mark shop as paid and store the recurring charge id and plan tier (starter | growth | pro). */
  async setPaidPlan(domain: string, recurringChargeId: string, plan: 'starter' | 'growth' | 'pro' = 'growth'): Promise<void> {
    const shop = await this.findByDomain(this.normalizeDomain(domain));
    if (shop) {
      shop.plan = plan;
      shop.recurringChargeId = recurringChargeId;
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  /** Clear billing when subscription is cancelled. */
  async clearBilling(domain: string): Promise<void> {
    const shop = await this.findByDomain(this.normalizeDomain(domain));
    if (shop) {
      shop.plan = 'free';
      shop.recurringChargeId = null;
      shop.updatedAt = new Date();
      await this.shopRepo.save(shop);
    }
  }

  /** True if shop has an active paid subscription (any tier). */
  hasPaidPlan(shop: Shop): boolean {
    const paid = shop.plan === 'starter' || shop.plan === 'growth' || shop.plan === 'pro' || shop.plan === 'paid';
    return paid && shop.recurringChargeId != null;
  }

  /** Current plan label for display (e.g. "Starter", "Growth", "Pro"). */
  getPlanLabel(shop: Shop): string {
    if (shop.plan === 'pro') return 'Pro';
    if (shop.plan === 'growth' || shop.plan === 'paid') return 'Growth';
    if (shop.plan === 'starter') return 'Starter';
    return 'Free';
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
