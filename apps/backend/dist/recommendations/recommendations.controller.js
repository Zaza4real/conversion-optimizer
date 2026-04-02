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
exports.RecommendationsController = void 0;
const common_1 = require("@nestjs/common");
const recommendations_service_1 = require("./recommendations.service");
const paid_plan_guard_1 = require("../billing/guards/paid-plan.guard");
const rule_registry_1 = require("../cro-rules/rule-registry");
let RecommendationsController = class RecommendationsController {
    constructor(recommendations) {
        this.recommendations = recommendations;
    }
    async list(req, _shopDomain, limit) {
        const shop = req[paid_plan_guard_1.REQUEST_SHOP_KEY];
        if (!shop)
            throw new Error('PaidPlanGuard should have set shop');
        const n = Math.min(parseInt(limit || '20', 10) || 20, 100);
        const list = await this.recommendations.findByShop(shop.id, n);
        return list.map((rec) => {
            const rule = (0, rule_registry_1.getRuleById)(rec.ruleId);
            const context = rec.patchPayload?.context;
            const appliesTo = context?.targetLabel
                ?? (rec.entityType === 'global' ? 'Store-wide theme' : `Product ${rec.entityId?.split('/').pop() ?? rec.entityId}`);
            const targetUrl = context?.productHandle ? `/products/${context.productHandle}` : undefined;
            return {
                id: rec.id,
                category: rec.category,
                severity: rec.severity,
                rationale: rec.rationale,
                expectedImpact: rec.expectedImpact ?? undefined,
                title: rule?.title ?? rec.category,
                appliesTo,
                issueDetail: context?.issueDetail,
                targetUrl,
            };
        });
    }
};
exports.RecommendationsController = RecommendationsController;
__decorate([
    (0, common_1.Get)(':shopDomain'),
    (0, common_1.UseGuards)(paid_plan_guard_1.PaidPlanGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('shopDomain')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], RecommendationsController.prototype, "list", null);
exports.RecommendationsController = RecommendationsController = __decorate([
    (0, common_1.Controller)('recommendations'),
    __metadata("design:paramtypes", [recommendations_service_1.RecommendationsService])
], RecommendationsController);
