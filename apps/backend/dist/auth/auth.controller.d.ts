import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ShopsService } from '../shops/shops.service';
export declare class AuthController {
    private readonly auth;
    private readonly config;
    private readonly shops;
    constructor(auth: AuthService, config: ConfigService, shops: ShopsService);
    forget(shop: string, res: Response): Promise<void>;
    debug(shop: string): Promise<{
        railwayUrl: string;
        clientIdPreview: string;
        shopStatus: string;
        tokenValid: boolean | null;
        tokenError: string | undefined;
        tokenAppApiKey: string | undefined;
        tokenAppTitle: string | undefined;
        tokenAppDeveloperType: string | undefined;
        tokenAppCheckError: string | undefined;
        tokenMatchesOurApp: boolean | undefined;
        canBill: boolean;
        nextStep: string;
    }>;
    install(shop: string, res: Response): Promise<void>;
    callback(query: Record<string, string>, res: Response): Promise<void>;
    private normalizeShop;
}
