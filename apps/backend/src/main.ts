import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // keep raw body for webhook HMAC
  });
  app.setGlobalPrefix('api');

  // Shopify sends install to App URL root (GET /?shop=...). Redirect to /api/auth.
  app.get('/', (req, res) => {
    const shop = req.query.shop as string;
    if (!shop?.trim()) {
      res.status(400).send('Missing shop parameter. Use /api/auth?shop=your-store.myshopify.com');
      return;
    }
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    res.redirect(302, `/api/auth?${query}`);
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Backend listening on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
