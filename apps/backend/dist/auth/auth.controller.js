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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const shops_service_1 = require("../shops/shops.service");
let AuthController = class AuthController {
    constructor(auth, config, shops) {
        this.auth = auth;
        this.config = config;
        this.shops = shops;
    }
    async forget(shop, res) {
        if (!shop?.trim()) {
            res.status(400).send('Missing shop parameter');
            return;
        }
        const shopNorm = this.normalizeShop(shop);
        await this.shops.deleteByDomain(shopNorm);
        const baseUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        res.redirect(302, `${baseUrl}/api/auth?shop=${encodeURIComponent(shopNorm)}`);
    }
    async debug(shop) {
        const appUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        const ourClientId = this.config.get('SHOPIFY_API_KEY') ?? '';
        const keyPreview = ourClientId.length >= 4 ? `${ourClientId.slice(0, 4)}...${ourClientId.slice(-4)}` : '(not set)';
        let shopStatus = 'no shop param';
        let tokenValid = null;
        let tokenError = null;
        let tokenAppApiKey = null;
        let tokenAppTitle = null;
        let tokenAppDeveloperType = null;
        let tokenAppCheckError = null;
        if (shop?.trim()) {
            const normalized = this.normalizeShop(shop);
            const found = await this.shops.findByDomain(normalized);
            shopStatus = found ? `shop exists (token stored)` : `no shop - open app to run OAuth`;
            if (found) {
                try {
                    const token = this.shops.getAccessToken(found);
                    const res = await fetch(`https://${normalized}/admin/api/2024-01/shop.json`, {
                        headers: { 'X-Shopify-Access-Token': token },
                    });
                    tokenValid = res.ok;
                    if (!res.ok) {
                        const text = await res.text();
                        tokenError = `${res.status}: ${text.slice(0, 200)}`;
                    }
                    else {
                        const gqlRes = await fetch(`https://${normalized}/admin/api/2024-01/graphql.json`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Shopify-Access-Token': token,
                            },
                            body: JSON.stringify({
                                query: `query { currentAppInstallation { app { apiKey, title, developerType } } }`,
                            }),
                        });
                        const gqlBody = (await gqlRes.json());
                        if (gqlRes.ok && gqlBody?.data?.currentAppInstallation?.app) {
                            const app = gqlBody.data.currentAppInstallation.app;
                            tokenAppApiKey = app.apiKey ?? null;
                            tokenAppTitle = app.title ?? null;
                            tokenAppDeveloperType = app.developerType ?? null;
                        }
                        else if (!gqlRes.ok) {
                            tokenAppCheckError = `GraphQL ${gqlRes.status}: ${JSON.stringify(gqlBody).slice(0, 150)}`;
                        }
                        else if (gqlBody?.errors?.length) {
                            tokenAppCheckError = gqlBody.errors.map((e) => e?.message ?? '').join('; ') || 'GraphQL errors';
                        }
                    }
                }
                catch (e) {
                    tokenValid = false;
                    tokenError = e instanceof Error ? e.message : String(e);
                }
            }
        }
        const tokenMatchesOurApp = tokenAppApiKey != null && tokenAppApiKey === ourClientId;
        const canBill = shopStatus === 'shop exists (token stored)' && tokenValid === true;
        let nextStep;
        if (!shop?.trim())
            nextStep = 'Add ?shop=your-store.myshopify.com';
        else if (shopStatus.startsWith('no shop'))
            nextStep = 'Open the app from Shopify Admin to run OAuth, or use /api/auth/forget?shop=... then open app';
        else if (tokenValid === false)
            nextStep = 'Token invalid (wrong app or revoked). Use /api/auth/forget?shop=' + encodeURIComponent(shop?.trim() ?? '') + ' then open the app from Shopify Admin to re-auth with the Dev Dashboard app.';
        else if (!tokenMatchesOurApp)
            nextStep = `Token is for a different app (${tokenAppTitle ?? tokenAppApiKey ?? 'unknown'}). Uninstall that app in Admin → Apps, use /api/auth/forget?shop=..., then install only the Dev Dashboard app and open it.`;
        else if (canBill)
            nextStep = 'Token is for this app. Try Subscribe. If you still get 422, the app may be store-owned in Partners: create a new app in Dev Dashboard or contact Shopify support.';
        else
            nextStep = 'Unexpected state';
        return {
            railwayUrl: appUrl,
            clientIdPreview: keyPreview,
            shopStatus,
            tokenValid,
            tokenError: tokenError ?? undefined,
            tokenAppApiKey: tokenAppApiKey ?? undefined,
            tokenAppTitle: tokenAppTitle ?? undefined,
            tokenAppDeveloperType: tokenAppDeveloperType ?? undefined,
            tokenAppCheckError: tokenAppCheckError ?? undefined,
            tokenMatchesOurApp: tokenAppApiKey != null ? tokenMatchesOurApp : undefined,
            canBill,
            nextStep,
        };
    }
    async install(shop, res) {
        if (!shop?.trim()) {
            res.status(400).send('Missing shop parameter');
            return;
        }
        const appUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        const clientId = this.config.get('SHOPIFY_API_KEY') ?? '';
        if (!appUrl || !clientId) {
            res.status(503).send('App configuration incomplete. Set SHOPIFY_APP_URL and SHOPIFY_API_KEY.');
            return;
        }
        const shopNorm = this.normalizeShop(shop);
        const redirectUri = `${appUrl}/api/auth/callback`;
        const scopes = this.config.get('SHOPIFY_SCOPES') || 'read_products,read_orders,read_themes';
        const state = this.auth.generateState(shopNorm);
        const url = `https://${shopNorm}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
        res.redirect(url);
    }
    async callback(query, res) {
        const code = query.code;
        const shop = query.shop;
        const state = query.state;
        if (!code || !shop?.trim()) {
            res.status(400).send('Missing code or shop');
            return;
        }
        const appUrl = this.config.get('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
        const secret = this.config.get('SHOPIFY_API_SECRET') ?? '';
        if (!appUrl || !secret) {
            res.status(503).send('App configuration incomplete. Set SHOPIFY_APP_URL and SHOPIFY_API_SECRET.');
            return;
        }
        if (!this.auth.verifyCallbackHmac(query)) {
            res.status(400).send('Invalid HMAC');
            return;
        }
        const shopNorm = this.normalizeShop(shop);
        if (!this.auth.consumeState(state, shopNorm)) {
            res.status(400).send('Invalid or expired state');
            return;
        }
        const { access_token, scope } = await this.auth.exchangeCode(shopNorm, code);
        const { wasUninstalled, isNew } = await this.auth.saveShopAndToken(shopNorm, access_token, scope);
        const qs = new URLSearchParams({ shop: shopNorm });
        if (wasUninstalled)
            qs.set('welcome_back', '1');
        else if (isNew)
            qs.set('welcome', '1');
        res.redirect(302, `${appUrl}/?${qs.toString()}`);
    }
    normalizeShop(shop) {
        const s = shop.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
        return s.includes('.myshopify.com') ? s : `${s}.myshopify.com`;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('forget'),
    __param(0, (0, common_1.Query)('shop')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forget", null);
__decorate([
    (0, common_1.Get)('debug'),
    __param(0, (0, common_1.Query)('shop')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "debug", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('shop')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "install", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "callback", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService,
        shops_service_1.ShopsService])
], AuthController);
