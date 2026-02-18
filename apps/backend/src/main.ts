import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // keep raw body for webhook HMAC
  });

  // Shopify sends install to App URL root (GET /?shop=...). Register first so it wins.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/', (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    if (!shop?.trim()) {
      res.status(400).send('Missing shop parameter. Use /api/auth?shop=your-store.myshopify.com');
      return;
    }
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    res.redirect(302, `/api/auth?${query}`);
  });

  app.setGlobalPrefix('api');
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Backend listening on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
