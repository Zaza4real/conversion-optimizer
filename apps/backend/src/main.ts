import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RequestMethod } from '@nestjs/common';
import * as path from 'path';
import * as express from 'express';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // keep raw body for webhook HMAC
  });

  // Static assets (logo, favicon) — serve before global prefix so /logo.png, /favicon.png work
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

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

  // GET /, favicon, scan/run, recommendations stay outside /api for app UI.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'favicon.ico', method: RequestMethod.GET },
      { path: 'scan/run', method: RequestMethod.GET },
      { path: 'recommendations', method: RequestMethod.GET },
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
