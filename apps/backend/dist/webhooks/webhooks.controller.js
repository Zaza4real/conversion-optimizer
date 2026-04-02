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
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const webhooks_service_1 = require("./webhooks.service");
let WebhooksController = class WebhooksController {
    constructor(webhooks) {
        this.webhooks = webhooks;
    }
    async handleTwo(topic0, topic1, req, res, hmacHeader, webhookId, shopDomain) {
        const topic = (0, webhooks_service_1.webhookTopicFromParams)(topic0, topic1);
        return this.handleRequest(topic, req, res, hmacHeader, webhookId, shopDomain);
    }
    async handleOne(topic, req, res, hmacHeader, webhookId, shopDomain) {
        return this.handleRequest(topic, req, res, hmacHeader, webhookId, shopDomain);
    }
    async handleRequest(topic, req, res, hmacHeader, webhookId, shopDomain) {
        const rawBody = req.rawBody ?? req.body;
        const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : (rawBody ? JSON.stringify(rawBody) : ''));
        if (!body) {
            res.status(400).send('No body');
            return;
        }
        if (!this.webhooks.verifyHmac(body, hmacHeader)) {
            res.status(401).send('Invalid HMAC');
            return;
        }
        const payload = typeof rawBody === 'object' && rawBody !== null ? rawBody : JSON.parse(body);
        const idempotencyKey = webhookId || payload.id?.toString() || payload.data_request?.id?.toString() || `${topic}-${shopDomain || 'unknown'}`;
        const alreadyProcessed = await this.webhooks.isProcessed(idempotencyKey);
        if (alreadyProcessed) {
            res.status(200).send('OK');
            return;
        }
        await this.webhooks.handle(topic, payload, shopDomain);
        await this.webhooks.markProcessed(idempotencyKey);
        res.status(200).send('OK');
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Post)(':topic0/:topic1'),
    __param(0, (0, common_1.Param)('topic0')),
    __param(1, (0, common_1.Param)('topic1')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __param(4, (0, common_1.Headers)('x-shopify-hmac-sha256')),
    __param(5, (0, common_1.Headers)('x-shopify-webhook-id')),
    __param(6, (0, common_1.Headers)('x-shopify-shop-domain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "handleTwo", null);
__decorate([
    (0, common_1.Post)(':topic'),
    __param(0, (0, common_1.Param)('topic')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __param(3, (0, common_1.Headers)('x-shopify-hmac-sha256')),
    __param(4, (0, common_1.Headers)('x-shopify-webhook-id')),
    __param(5, (0, common_1.Headers)('x-shopify-shop-domain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "handleOne", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, common_1.Controller)('webhooks/shopify'),
    __metadata("design:paramtypes", [webhooks_service_1.WebhooksService])
], WebhooksController);
