"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_config_1 = require("./config/typeorm.config");
const common_module_1 = require("./common/common.module");
const shops_module_1 = require("./shops/shops.module");
const auth_module_1 = require("./auth/auth.module");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const scan_module_1 = require("./scan/scan.module");
const recommendations_module_1 = require("./recommendations/recommendations.module");
const root_module_1 = require("./root/root.module");
const billing_module_1 = require("./billing/billing.module");
const landing_module_1 = require("./landing/landing.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env', '../../.env'],
            }),
            typeorm_1.TypeOrmModule.forRoot((0, typeorm_config_1.getTypeOrmConfig)()),
            bullmq_1.BullModule.forRoot({
                connection: process.env.REDIS_URL
                    ? { url: process.env.REDIS_URL }
                    : { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) },
            }),
            common_module_1.CommonModule,
            shops_module_1.ShopsModule,
            auth_module_1.AuthModule,
            webhooks_module_1.WebhooksModule,
            scan_module_1.ScanModule,
            recommendations_module_1.RecommendationsModule,
            billing_module_1.BillingModule,
            root_module_1.RootModule,
            landing_module_1.LandingModule,
        ],
    })
], AppModule);
