"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const path = require("path");
const express = require("express");
const compression = require("compression");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
async function bootstrap() {
    console.log('[BuildMarker] backend-start BUILD_MARKER_2026-04-02_INSTALL_WELCOME_v1');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        rawBody: true,
    });
    app.useGlobalFilters(new http_exception_filter_1.GlobalExceptionFilter());
    app.use(compression());
    const publicDir = path.join(__dirname, '..', 'public');
    app.use(express.static(publicDir, { maxAge: '1d' }));
    app.use((req, res, next) => {
        const shop = req.query?.shop?.trim();
        const shopHost = shop && /\.myshopify\.com$/i.test(shop)
            ? `https://${shop.replace(/^https?:\/\//, '').split('/')[0]}`
            : null;
        const ancestors = [
            'https://admin.shopify.com',
            'https://*.admin.shopify.com',
            "https://*.myshopify.com",
            "'self'",
            ...(shopHost ? [shopHost] : []),
        ].join(' ');
        res.setHeader('Content-Security-Policy', `frame-ancestors ${ancestors};`);
        next();
    });
    app.setGlobalPrefix('api', {
        exclude: [
            { path: '/', method: common_1.RequestMethod.GET },
            { path: 'favicon.ico', method: common_1.RequestMethod.GET },
            { path: 'scan/run', method: common_1.RequestMethod.GET },
            { path: 'recommendations', method: common_1.RequestMethod.GET },
            { path: 'privacy', method: common_1.RequestMethod.GET },
            { path: 'refund', method: common_1.RequestMethod.GET },
            { path: 'support', method: common_1.RequestMethod.GET },
            { path: 'landing', method: common_1.RequestMethod.GET },
            { path: 'billing/confirm', method: common_1.RequestMethod.GET },
            { path: 'billing/cancel-confirm', method: common_1.RequestMethod.GET },
            { path: 'health', method: common_1.RequestMethod.GET },
            { path: 'health/billing-repair', method: common_1.RequestMethod.GET },
            { path: 'farewell', method: common_1.RequestMethod.GET },
        ],
    });
    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`Backend ready on port ${port} (requests served at /api and /)`);
}
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
