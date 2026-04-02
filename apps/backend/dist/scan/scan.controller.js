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
exports.ScanController = void 0;
const common_1 = require("@nestjs/common");
const scan_service_1 = require("./scan.service");
const paid_plan_guard_1 = require("../billing/guards/paid-plan.guard");
let ScanController = class ScanController {
    constructor(scan) {
        this.scan = scan;
    }
    async start(req) {
        const shop = req[paid_plan_guard_1.REQUEST_SHOP_KEY];
        if (!shop)
            throw new Error('PaidPlanGuard should have set shop');
        return this.scan.enqueueScan(shop.id);
    }
    async jobStatus(jobId) {
        return this.scan.getJobStatus(jobId);
    }
};
exports.ScanController = ScanController;
__decorate([
    (0, common_1.Post)(':shopDomain'),
    (0, common_1.UseGuards)(paid_plan_guard_1.PaidPlanGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScanController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('job/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ScanController.prototype, "jobStatus", null);
exports.ScanController = ScanController = __decorate([
    (0, common_1.Controller)('scan'),
    __metadata("design:paramtypes", [scan_service_1.ScanService])
], ScanController);
