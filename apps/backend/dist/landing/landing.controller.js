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
exports.LandingController = void 0;
const common_1 = require("@nestjs/common");
const landing_service_1 = require("./landing.service");
let LandingController = class LandingController {
    constructor(landing) {
        this.landing = landing;
    }
    async newsletter(email, returnTo, res) {
        const { redirect } = await this.landing.subscribeNewsletter(email ?? '', returnTo ?? '');
        res.redirect(303, redirect);
    }
};
exports.LandingController = LandingController;
__decorate([
    (0, common_1.Post)('newsletter'),
    __param(0, (0, common_1.Body)('email')),
    __param(1, (0, common_1.Body)('return_to')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], LandingController.prototype, "newsletter", null);
exports.LandingController = LandingController = __decorate([
    (0, common_1.Controller)('landing'),
    __metadata("design:paramtypes", [landing_service_1.LandingService])
], LandingController);
