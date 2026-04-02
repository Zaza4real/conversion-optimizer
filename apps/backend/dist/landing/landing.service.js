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
exports.LandingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const newsletter_signup_entity_1 = require("./entities/newsletter-signup.entity");
let LandingService = class LandingService {
    constructor(newsletterRepo, config) {
        this.newsletterRepo = newsletterRepo;
        this.config = config;
    }
    async subscribeNewsletter(email, returnTo) {
        const normalized = email?.trim().toLowerCase();
        if (!normalized || !normalized.includes('@')) {
            const fallback = returnTo?.trim() || '/';
            return { redirect: fallback.includes('?') ? `${fallback}&newsletter=invalid` : `${fallback}?newsletter=invalid` };
        }
        await this.newsletterRepo.save(this.newsletterRepo.create({ email: normalized }));
        const notifyTo = this.config.get('NEWSLETTER_NOTIFY_EMAIL');
        const host = this.config.get('SMTP_HOST');
        const user = this.config.get('SMTP_USER');
        const pass = this.config.get('SMTP_PASS');
        if (notifyTo && host && user && pass) {
            try {
                const nodemailer = await Promise.resolve().then(() => require('nodemailer'));
                const port = Number(this.config.get('SMTP_PORT')) || 587;
                const secure = this.config.get('SMTP_SECURE') === 'true';
                const transporter = nodemailer.default.createTransport({
                    host,
                    port,
                    secure,
                    auth: { user, pass },
                });
                await transporter.sendMail({
                    from: user,
                    to: notifyTo,
                    subject: `[Conversion Optimizer] New newsletter signup: ${normalized}`,
                    text: `A visitor signed up for your email list.\n\nEmail: ${normalized}\nTime: ${new Date().toISOString()}`,
                    html: `<p>A visitor signed up for your email list.</p><p><strong>Email:</strong> ${normalized}</p><p><strong>Time:</strong> ${new Date().toISOString()}</p>`,
                });
            }
            catch {
            }
        }
        const base = (returnTo?.trim() || '/').replace(/#.*$/, '');
        const sep = base.includes('?') ? '&' : '?';
        return { redirect: `${base}${sep}newsletter=success` };
    }
};
exports.LandingService = LandingService;
exports.LandingService = LandingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(newsletter_signup_entity_1.NewsletterSignup)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], LandingService);
