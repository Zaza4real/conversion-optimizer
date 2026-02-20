import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RequestMethod } from '@nestjs/common';
import * as path from 'path';
import * as express from 'express';
import * as compression from 'compression';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // keep raw body for webhook HMAC
  });

  // Compress responses (gzip) to reduce transfer time for large HTML/JSON
  app.use(compression());

  // Static assets (logo, favicon) — cache 1 day so repeat loads are faster
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { maxAge: '1d' }));

  // Allow this app to be embedded in Shopify Admin iframe (fixes "refused to connect").
  // Shopify requires frame-ancestors to include the shop domain and admin.shopify.com.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const shop = (req.query?.shop as string)?.trim();
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

  // GET /, favicon, scan/run, recommendations, privacy, refund, support, landing, health — outside /api for app UI and policies.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'favicon.ico', method: RequestMethod.GET },
      { path: 'scan/run', method: RequestMethod.GET },
      { path: 'recommendations', method: RequestMethod.GET },
      { path: 'privacy', method: RequestMethod.GET },
      { path: 'refund', method: RequestMethod.GET },
      { path: 'support', method: RequestMethod.GET },
      { path: 'landing', method: RequestMethod.GET },
      { path: 'billing/confirm', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
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
