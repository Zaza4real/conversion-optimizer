import { ConfigService } from '@nestjs/config';
import { ShopsService } from '../shops/shops.service';
export declare class AuthService {
    private readonly config;
    private readonly shops;
    constructor(config: ConfigService, shops: ShopsService);
    generateState(shop: string): string;
    verifyCallbackHmac(query: Record<string, string>): boolean;
    consumeState(state: string, shop: string): boolean;
    exchangeCode(shop: string, code: string): Promise<{
        access_token: string;
        scope?: string;
    }>;
    saveShopAndToken(shop: string, accessToken: string, scope?: string): Promise<void>;
}
