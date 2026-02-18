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
      plan: 'starter',
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

  private normalizeDomain(domain: string): string {
    const d = domain.toLowerCase().trim();
    return d.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
  }
}
