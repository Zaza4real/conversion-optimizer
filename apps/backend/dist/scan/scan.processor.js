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
exports.ScanProcessor = exports.SCAN_QUEUE = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shops_service_1 = require("../shops/shops.service");
const shopify_api_service_1 = require("../shopify/shopify-api.service");
const recommendation_entity_1 = require("../recommendations/entities/recommendation.entity");
const scan_rules_evaluator_1 = require("./scan-rules.evaluator");
exports.SCAN_QUEUE = 'scan';
let ScanProcessor = class ScanProcessor extends bullmq_1.WorkerHost {
    constructor(recRepo, shops, shopify) {
        super();
        this.recRepo = recRepo;
        this.shops = shops;
        this.shopify = shopify;
    }
    async process(job) {
        const { shopId } = job.data;
        const shop = await this.shops.getById(shopId);
        const domain = shop.domain;
        const token = this.shops.getAccessToken(shop);
        const products = [];
        for await (const page of this.shopify.fetchProducts(domain, token, 4)) {
            products.push(...page);
        }
        const themeContext = {
            hasBlock: () => false,
        };
        const productRecs = (0, scan_rules_evaluator_1.runProductRules)(products);
        const globalRecs = (0, scan_rules_evaluator_1.runGlobalRules)(themeContext);
        const all = [...productRecs, ...globalRecs].map((r) => ({
            ...r,
            priority: (0, scan_rules_evaluator_1.priorityScore)(r.rule, (0, scan_rules_evaluator_1.getImpactMid)(r.rule)),
        }));
        all.sort((a, b) => b.priority - a.priority);
        await this.recRepo.delete({ shopId });
        const toInsert = all.slice(0, 50).map((r) => this.recRepo.create({
            shopId,
            entityType: r.entityType,
            entityId: r.entityId,
            category: r.rule.category,
            ruleId: r.rule.id,
            severity: r.rule.severity,
            rationale: r.rule.description,
            expectedImpact: r.rule.impact_estimate ?? null,
            patchPayload: r.patchPayload,
            status: 'pending',
        }));
        await this.recRepo.save(toInsert);
        return { recommendationsCreated: toInsert.length };
    }
};
exports.ScanProcessor = ScanProcessor;
exports.ScanProcessor = ScanProcessor = __decorate([
    (0, bullmq_1.Processor)(exports.SCAN_QUEUE),
    __param(0, (0, typeorm_1.InjectRepository)(recommendation_entity_1.Recommendation)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        shops_service_1.ShopsService,
        shopify_api_service_1.ShopifyApiService])
], ScanProcessor);
