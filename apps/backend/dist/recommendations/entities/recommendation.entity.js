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
exports.Recommendation = void 0;
const typeorm_1 = require("typeorm");
const shop_entity_1 = require("../../shops/entities/shop.entity");
let Recommendation = class Recommendation {
};
exports.Recommendation = Recommendation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Recommendation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shop_id', type: 'uuid' }),
    __metadata("design:type", String)
], Recommendation.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entity_type', type: 'text' }),
    __metadata("design:type", String)
], Recommendation.prototype, "entityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entity_id', type: 'text' }),
    __metadata("design:type", String)
], Recommendation.prototype, "entityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Recommendation.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rule_id', type: 'text' }),
    __metadata("design:type", String)
], Recommendation.prototype, "ruleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Recommendation.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Recommendation.prototype, "rationale", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_impact', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Recommendation.prototype, "expectedImpact", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'patch_payload', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Recommendation.prototype, "patchPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: 'pending' }),
    __metadata("design:type", String)
], Recommendation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Recommendation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Recommendation.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => shop_entity_1.Shop, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'shop_id' }),
    __metadata("design:type", shop_entity_1.Shop)
], Recommendation.prototype, "shop", void 0);
exports.Recommendation = Recommendation = __decorate([
    (0, typeorm_1.Entity)('recommendations'),
    (0, typeorm_1.Index)('IDX_recommendations_shop_created', ['shopId', 'createdAt'])
], Recommendation);
