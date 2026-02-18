import { Controller, Post, Param, Req, Res, Headers, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/shopify')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  /**
   * POST /api/webhooks/shopify/:topic
   * Body is raw for HMAC verification. Topic e.g. app_uninstalled, products_create, orders_create.
   */
  @Post(':topic')
  async handle(
    @Param('topic') topic: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
  ) {
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
    const idempotencyKey = webhookId || payload.id?.toString() || `${topic}-${shopDomain || 'unknown'}`;
    const alreadyProcessed = await this.webhooks.isProcessed(idempotencyKey);
    if (alreadyProcessed) {
      res.status(200).send('OK');
      return;
    }
    await this.webhooks.handle(topic, payload, shopDomain);
    await this.webhooks.markProcessed(idempotencyKey);
    res.status(200).send('OK');
  }
}
