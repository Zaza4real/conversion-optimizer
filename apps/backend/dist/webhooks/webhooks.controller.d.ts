import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhooksService } from './webhooks.service';
export declare class WebhooksController {
    private readonly webhooks;
    constructor(webhooks: WebhooksService);
    handleTwo(topic0: string, topic1: string, req: RawBodyRequest<Request>, res: Response, hmacHeader: string, webhookId: string, shopDomain: string): Promise<void>;
    handleOne(topic: string, req: RawBodyRequest<Request>, res: Response, hmacHeader: string, webhookId: string, shopDomain: string): Promise<void>;
    private handleRequest;
}
