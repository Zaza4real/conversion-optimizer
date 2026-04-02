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
exports.PaidPlanGuard = exports.SkipPaidPlan = exports.REQUEST_SHOP_KEY = exports.PAID_PLAN_SKIP = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const shops_service_1 = require("../../shops/shops.service");
exports.PAID_PLAN_SKIP = 'paid_plan_skip';
exports.REQUEST_SHOP_KEY = 'conversionOptimizerShop';
const SkipPaidPlan = () => (0, common_1.SetMetadata)(exports.PAID_PLAN_SKIP, true);
exports.SkipPaidPlan = SkipPaidPlan;
let PaidPlanGuard = class PaidPlanGuard {
    constructor(shops, reflector) {
        this.shops = shops;
        this.reflector = reflector;
    }
    async canActivate(context) {
        if (this.reflector.get(exports.PAID_PLAN_SKIP, context.getHandler())) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const shopDomain = request.params?.shopDomain?.replace(/%2E/g, '.').toLowerCase().trim();
        if (!shopDomain)
            return false;
        try {
            const shop = await this.shops.getByDomain(shopDomain);
            request[exports.REQUEST_SHOP_KEY] = shop;
            if (this.shops.hasPaidPlan(shop))
                return true;
            throw new common_1.HttpException({
                error: 'Subscription required',
                message: 'Upgrade to run scans and view recommendations. Choose a plan from the app home.',
                upgradeUrl: `/api/billing/subscribe?shop=${encodeURIComponent(shop.domain)}`,
            }, common_1.HttpStatus.PAYMENT_REQUIRED);
        }
        catch (e) {
            if (e instanceof common_1.HttpException)
                throw e;
            throw new common_1.HttpException({ error: 'Shop not found', message: 'Invalid shop.' }, common_1.HttpStatus.NOT_FOUND);
        }
    }
};
exports.PaidPlanGuard = PaidPlanGuard;
exports.PaidPlanGuard = PaidPlanGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shops_service_1.ShopsService,
        core_1.Reflector])
], PaidPlanGuard);
