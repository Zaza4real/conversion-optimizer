"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shop_entity_1 = require("./entities/shop.entity");
const encryption_service_1 = require("../common/encryption.service");
const FREE_BETA_SHOPS_KEY = 'FREE_BETA_SHOPS';
let ShopsService = class ShopsService {
    constructor(shopRepo, encryption, config) {
        this.shopRepo = shopRepo;
        this.encryption = encryption;
        this.config = config;
    }
    async findByDomain(domain) {
        return this.shopRepo.findOne({ where: { domain: this.normalizeDomain(domain) } });
    }
    async getById(id) {
        const shop = await this.shopRepo.findOne({ where: { id } });
        if (!shop)
            throw new common_1.NotFoundException('Shop not found');
        return shop;
    }
    async getByDomain(domain) {
        const shop = await this.findByDomain(domain);
        if (!shop)
            throw new common_1.NotFoundException('Shop not found');
        return shop;
    }
    async upsertWithToken(domain, accessToken, scope) {
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
    getAccessToken(shop) {
        return this.encryption.decrypt(shop.accessTokenEnc);
    }
    async markUninstalled(domain) {
        const shop = await this.findByDomain(domain);
        if (shop) {
            shop.uninstalledAt = new Date();
            await this.shopRepo.save(shop);
        }
    }
    async setPaidPlan(domain, recurringChargeId, plan = 'growth', options) {
        const shop = await this.findByDomain(this.normalizeDomain(domain));
        if (shop) {
            shop.plan = plan;
            shop.recurringChargeId = recurringChargeId;
            const merged = {
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
    async clearBilling(domain, billingGraceUntil, cancelledPlanLabel) {
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
    isFreeBetaShop(domain) {
        const raw = this.config.get(FREE_BETA_SHOPS_KEY) ?? process.env[FREE_BETA_SHOPS_KEY] ?? '';
        if (!raw.trim())
            return false;
        const normalized = this.normalizeDomain(domain);
        const list = raw.split(',').map((d) => this.normalizeDomain(d)).filter(Boolean);
        return list.includes(normalized);
    }
    hasPaidPlan(shop) {
        if (this.isFreeBetaShop(shop.domain))
            return true;
        const paid = shop.plan === 'starter' || shop.plan === 'growth' || shop.plan === 'pro' || shop.plan === 'pro_annual' || shop.plan === 'paid';
        if (paid && shop.recurringChargeId != null)
            return true;
        const graceUntil = this.getBillingGraceUntil(shop);
        if (!graceUntil)
            return false;
        const graceDate = new Date(graceUntil);
        return !Number.isNaN(graceDate.getTime()) && graceDate.getTime() > Date.now();
    }
    getPlanLabel(shop) {
        if (this.isFreeBetaShop(shop.domain))
            return 'Free beta';
        if (shop.plan === 'free') {
            const cancelledLabel = this.getCancelledPlanLabel(shop);
            if (cancelledLabel)
                return cancelledLabel;
        }
        if (shop.plan === 'pro_annual')
            return 'Pro Annual';
        if (shop.plan === 'pro')
            return 'Pro';
        if (shop.plan === 'growth' || shop.plan === 'paid')
            return 'Growth';
        if (shop.plan === 'starter')
            return 'Starter';
        return 'Free';
    }
    isBillingCancelledPending(shop) {
        const until = this.getBillingGraceUntil(shop);
        if (until?.trim()) {
            const d = new Date(until);
            if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now())
                return true;
        }
        if (shop.plan === 'free' && this.getCancelledPlanLabel(shop)?.trim())
            return true;
        return false;
    }
    getBillingGraceUntil(shop) {
        const raw = (shop.settings ?? {})['billingGraceUntil'];
        return typeof raw === 'string' && raw.trim() ? raw : null;
    }
    getCancelledPlanLabel(shop) {
        const raw = (shop.settings ?? {})['cancelledPlanLabel'];
        return typeof raw === 'string' && raw.trim() ? raw : null;
    }
    async repairCancelledPlanLabel(domain, label) {
        const shop = await this.findByDomain(this.normalizeDomain(domain));
        if (shop) {
            shop.settings = { ...(shop.settings ?? {}), cancelledPlanLabel: label };
            shop.updatedAt = new Date();
            await this.shopRepo.save(shop);
        }
    }
    getBillingPeriodEnd(shop) {
        const raw = (shop.settings ?? {})['billingPeriodEndIso'];
        return typeof raw === 'string' && raw.trim() ? raw : null;
    }
    async findByRecurringChargeId(chargeId) {
        return this.shopRepo.findOne({
            where: { recurringChargeId: String(chargeId) },
        });
    }
    async deleteByDomain(domain) {
        const normalized = this.normalizeDomain(domain);
        const result = await this.shopRepo.delete({ domain: normalized });
        return (result.affected ?? 0) > 0;
    }
    normalizeDomain(domain) {
        const d = domain.toLowerCase().trim();
        return d.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    }
};
exports.ShopsService = ShopsService;
exports.ShopsService = ShopsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(shop_entity_1.Shop)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        encryption_service_1.EncryptionService,
        config_1.ConfigService])
], ShopsService);
