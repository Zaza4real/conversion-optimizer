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
exports.Shop = void 0;
const typeorm_1 = require("typeorm");
const product_cache_entity_1 = require("../../products-cache/entities/product-cache.entity");
const recommendation_entity_1 = require("../../recommendations/entities/recommendation.entity");
let Shop = class Shop {
};
exports.Shop = Shop;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Shop.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', unique: true }),
    __metadata("design:type", String)
], Shop.prototype, "domain", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bytea', name: 'access_token_enc' }),
    __metadata("design:type", Buffer)
], Shop.prototype, "accessTokenEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Shop.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: 'free' }),
    __metadata("design:type", String)
], Shop.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'recurring_charge_id', nullable: true }),
    __metadata("design:type", Object)
], Shop.prototype, "recurringChargeId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'installed_at' }),
    __metadata("design:type", Date)
], Shop.prototype, "installedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Shop.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], Shop.prototype, "settings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'uninstalled_at', nullable: true }),
    __metadata("design:type", Object)
], Shop.prototype, "uninstalledAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => product_cache_entity_1.ProductCache, (pc) => pc.shop),
    __metadata("design:type", Array)
], Shop.prototype, "productsCache", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => recommendation_entity_1.Recommendation, (r) => r.shop),
    __metadata("design:type", Array)
], Shop.prototype, "recommendations", void 0);
exports.Shop = Shop = __decorate([
    (0, typeorm_1.Entity)('shops')
], Shop);
