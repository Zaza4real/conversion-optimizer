import { Controller, Post, Param, Req, Res, Headers, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhooksService, webhookTopicFromParams } from './webhooks.service';

@Controller('webhooks/shopify')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  /**
   * POST /api/webhooks/shopify/:topic0/:topic1
   * For compliance webhooks: customers/data_request, customers/redact, shop/redact.
   */
  @Post(':topic0/:topic1')
  async handleTwo(
    @Param('topic0') topic0: string,
    @Param('topic1') topic1: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
  ) {
    const topic = webhookTopicFromParams(topic0, topic1);
    return this.handleRequest(topic, req, res, hmacHeader, webhookId, shopDomain);
  }

  /**
   * POST /api/webhooks/shopify/:topic
   * Event webhooks: app_uninstalled, app_subscriptions_update, app_subscriptions_delete, etc.
   */
  @Post(':topic')
  async handleOne(
    @Param('topic') topic: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
  ) {
    return this.handleRequest(topic, req, res, hmacHeader, webhookId, shopDomain);
  }

  private async handleRequest(
    topic: string,
    req: RawBodyRequest<Request>,
    res: Response,
    hmacHeader: string,
    webhookId: string,
    shopDomain: string,
  ): Promise<void> {
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
    const idempotencyKey = webhookId || payload.id?.toString() || (payload as { data_request?: { id?: number } }).data_request?.id?.toString() || `${topic}-${shopDomain || 'unknown'}`;
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
