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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const shops_service_1 = require("../shops/shops.service");
const STATE_TTL_MS = 600_000;
const stateStore = new Map();
let AuthService = class AuthService {
    constructor(config, shops) {
        this.config = config;
        this.shops = shops;
    }
    generateState(shop) {
        const state = (0, crypto_1.randomBytes)(16).toString('hex');
        stateStore.set(state, { shop, expires: Date.now() + STATE_TTL_MS });
        return state;
    }
    verifyCallbackHmac(query) {
        const hmac = query.hmac;
        if (!hmac)
            return false;
        const sorted = Object.keys(query)
            .filter((k) => k !== 'hmac')
            .sort()
            .map((k) => `${k}=${query[k]}`)
            .join('&');
        const secret = this.config.get('SHOPIFY_API_SECRET');
        const expected = (0, crypto_1.createHmac)('sha256', secret).update(sorted).digest('hex');
        return expected === hmac;
    }
    consumeState(state, shop) {
        const entry = stateStore.get(state);
        if (!entry || entry.shop !== shop || entry.expires < Date.now())
            return false;
        stateStore.delete(state);
        return true;
    }
    async exchangeCode(shop, code) {
        const clientId = this.config.get('SHOPIFY_API_KEY');
        const clientSecret = this.config.get('SHOPIFY_API_SECRET');
        const redirectUri = this.config.get('SHOPIFY_APP_URL').replace(/\/$/, '') + '/api/auth/callback';
        const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Token exchange failed: ${res.status} ${text}`);
        }
        const data = await res.json();
        return { access_token: data.access_token, scope: data.scope };
    }
    async saveShopAndToken(shop, accessToken, scope) {
        const result = await this.shops.upsertWithToken(shop, accessToken, scope);
        return { wasUninstalled: result.wasUninstalled, isNew: result.isNew };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        shops_service_1.ShopsService])
], AuthService);
