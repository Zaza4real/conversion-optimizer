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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksService = void 0;
exports.webhookTopicFromParams = webhookTopicFromParams;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const shops_service_1 = require("../shops/shops.service");
const PROCESSED_TTL_SEC = 86400;
const processed = new Map();
function pruneProcessed() {
    const now = Date.now();
    for (const [k, exp] of processed.entries()) {
        if (exp < now)
            processed.delete(k);
    }
}
let WebhooksService = class WebhooksService {
    constructor(config, shops) {
        this.config = config;
        this.shops = shops;
    }
    verifyHmac(rawBody, hmacHeader) {
        if (!hmacHeader)
            return false;
        const secret = this.config.get('SHOPIFY_API_SECRET');
        const computed = (0, crypto_1.createHmac)('sha256', secret).update(rawBody, 'utf8').digest('base64');
        return computed === hmacHeader;
    }
    async isProcessed(idempotencyKey) {
        if (processed.size > 10000)
            pruneProcessed();
        const exp = processed.get(idempotencyKey);
        return exp != null && exp > Date.now();
    }
    async markProcessed(idempotencyKey) {
        processed.set(idempotencyKey, Date.now() + PROCESSED_TTL_SEC * 1000);
    }
    async handle(topic, payload, shopDomainHeader) {
        const shopDomain = shopDomainHeader?.toLowerCase().trim() || this.getShopDomain(payload);
        if (!shopDomain)
            return;
        switch (topic) {
            case 'app_uninstalled':
                await this.shops.markUninstalled(shopDomain);
                break;
            case 'app_subscriptions_update':
            case 'app_subscriptions_delete':
                await this.handleSubscriptionUpdate(payload, shopDomain);
                break;
            case 'customers/data_request':
                break;
            case 'customers/redact':
                break;
            case 'shop/redact':
                await this.shops.deleteByDomain(shopDomain);
                break;
            case 'products_create':
            case 'products_update':
                break;
            case 'products_delete':
            case 'orders_create':
            case 'orders_updated':
            case 'themes_publish':
            case 'shop_update':
                break;
            default:
                break;
        }
    }
    async handleSubscriptionUpdate(payload, shopDomain) {
        const sub = payload.app_subscription;
        if (!sub)
            return;
        const status = sub.status;
        if (status !== 'cancelled' && status !== 'expired' && status !== 'frozen')
            return;
        const rawId = sub.id ?? payload.recurring_application_charge_id;
        const chargeId = typeof rawId === 'number' ? String(rawId) : typeof rawId === 'string' ? rawId.replace(/^.*\/(\d+)$/, '$1') : null;
        if (chargeId) {
            const shop = await this.shops.findByRecurringChargeId(chargeId);
            if (shop)
                await this.shops.clearBilling(shop.domain);
        }
        else {
            await this.shops.clearBilling(shopDomain);
        }
    }
    getShopDomain(payload) {
        const shop = payload.shop;
        if (typeof shop === 'string')
            return shop;
        const d = payload.shop_domain;
        if (typeof d === 'string')
            return d;
        return null;
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        shops_service_1.ShopsService])
], WebhooksService);
function webhookTopicFromParams(topicOrPart0, topicPart1) {
    if (topicPart1 != null)
        return `${topicOrPart0}/${topicPart1}`;
    return topicOrPart0;
}
