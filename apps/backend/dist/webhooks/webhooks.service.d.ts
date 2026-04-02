import { ConfigService } from '@nestjs/config';
import { ShopsService } from '../shops/shops.service';
export declare class WebhooksService {
    private readonly config;
    private readonly shops;
    constructor(config: ConfigService, shops: ShopsService);
    verifyHmac(rawBody: string, hmacHeader: string | undefined): boolean;
    isProcessed(idempotencyKey: string): Promise<boolean>;
    markProcessed(idempotencyKey: string): Promise<void>;
    handle(topic: string, payload: Record<string, unknown>, shopDomainHeader?: string): Promise<void>;
    private handleSubscriptionUpdate;
    private getShopDomain;
}
export declare function webhookTopicFromParams(topicOrPart0: string, topicPart1?: string): string;
