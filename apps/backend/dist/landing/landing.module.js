"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const newsletter_signup_entity_1 = require("./entities/newsletter-signup.entity");
const landing_service_1 = require("./landing.service");
const landing_controller_1 = require("./landing.controller");
let LandingModule = class LandingModule {
};
exports.LandingModule = LandingModule;
exports.LandingModule = LandingModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([newsletter_signup_entity_1.NewsletterSignup])],
        controllers: [landing_controller_1.LandingController],
        providers: [landing_service_1.LandingService],
    })
], LandingModule);
