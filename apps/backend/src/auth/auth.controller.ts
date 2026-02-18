import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ShopsService } from '../shops/shops.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly shops: ShopsService,
  ) {}

  /**
   * GET /api/auth/forget?shop=store.myshopify.com
   * Deletes the shop record so the next app open runs fresh OAuth and saves a new token.
   * Use this when you get 401 on billing (stale/wrong token).
   */
  @Get('forget')
  async forget(@Query('shop') shop: string, @Res() res: Response) {
    if (!shop?.trim()) {
      res.status(400).send('Missing shop parameter');
      return;
    }
    const shopNorm = this.normalizeShop(shop);
    await this.shops.deleteByDomain(shopNorm);
    const baseUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    res.redirect(302, `${baseUrl}/api/auth?shop=${encodeURIComponent(shopNorm)}`);
  }

  /**
   * GET /api/auth/debug?shop=store.myshopify.com
   * Shows which app the backend uses and whether the stored token works with Shopify.
   * Use this to verify Railway config and token before trying Subscribe.
   */
  @Get('debug')
  async debug(@Query('shop') shop: string) {
    const appUrl = this.config.get<string>('SHOPIFY_APP_URL')?.replace(/\/$/, '') ?? '';
    const ourClientId = this.config.get<string>('SHOPIFY_API_KEY') ?? '';
    const keyPreview = ourClientId.length >= 4 ? `${ourClientId.slice(0, 4)}...${ourClientId.slice(-4)}` : '(not set)';
    let shopStatus = 'no shop param';
    let tokenValid: boolean | null = null;
    let tokenError: string | null = null;
    let tokenAppApiKey: string | null = null;
    let tokenAppTitle: string | null = null;
    let tokenAppDeveloperType: string | null = null;
    let tokenAppCheckError: string | null = null;
    if (shop?.trim()) {
      const normalized = this.normalizeShop(shop);
      const found = await this.shops.findByDomain(normalized);
      shopStatus = found ? `shop exists (token stored)` : `no shop - open app to run OAuth`;
      if (found) {
        try {
          const token = this.shops.getAccessToken(found);
          const res = await fetch(`https://${normalized}/admin/api/2024-01/shop.json`, {
            headers: { 'X-Shopify-Access-Token': token },
          });
          tokenValid = res.ok;
          if (!res.ok) {
            const text = await res.text();
            tokenError = `${res.status}: ${text.slice(0, 200)}`;
          } else {
            const gqlRes = await fetch(`https://${normalized}/admin/api/2024-01/graphql.json`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': token,
              },
              body: JSON.stringify({
                query: `query { currentAppInstallation { app { apiKey, title, developerType } } }`,
              }),
            });
            const gqlBody = (await gqlRes.json()) as { data?: { currentAppInstallation?: { app?: { apiKey?: string; title?: string; developerType?: string } } }; errors?: { message?: string }[] };
            if (gqlRes.ok && gqlBody?.data?.currentAppInstallation?.app) {
              const app = gqlBody.data.currentAppInstallation.app;
              tokenAppApiKey = app.apiKey ?? null;
              tokenAppTitle = app.title ?? null;
              tokenAppDeveloperType = app.developerType ?? null;
            } else if (!gqlRes.ok) {
              tokenAppCheckError = `GraphQL ${gqlRes.status}: ${JSON.stringify(gqlBody).slice(0, 150)}`;
            } else if (gqlBody?.errors?.length) {
              tokenAppCheckError = gqlBody.errors.map((e) => e?.message ?? '').join('; ') || 'GraphQL errors';
            }
          }
        } catch (e) {
          tokenValid = false;
          tokenError = e instanceof Error ? e.message : String(e);
        }
      }
    }
    const tokenMatchesOurApp = tokenAppApiKey != null && tokenAppApiKey === ourClientId;
    const canBill = shopStatus === 'shop exists (token stored)' && tokenValid === true;
    let nextStep: string;
    if (!shop?.trim()) nextStep = 'Add ?shop=your-store.myshopify.com';
    else if (shopStatus.startsWith('no shop')) nextStep = 'Open the app from Shopify Admin to run OAuth, or use /api/auth/forget?shop=... then open app';
    else if (tokenValid === false) nextStep = 'Token invalid (wrong app or revoked). Use /api/auth/forget?shop=' + encodeURIComponent(shop?.trim() ?? '') + ' then open the app from Shopify Admin to re-auth with the Dev Dashboard app.';
    else if (!tokenMatchesOurApp) nextStep = `Token is for a different app (${tokenAppTitle ?? tokenAppApiKey ?? 'unknown'}). Uninstall that app in Admin → Apps, use /api/auth/forget?shop=..., then install only the Dev Dashboard app and open it.`;
    else if (canBill) nextStep = 'Token is for this app. Try Subscribe. If you still get 422, the app may be store-owned in Partners: create a new app in Dev Dashboard or contact Shopify support.';
    else nextStep = 'Unexpected state';

    return {
      railwayUrl: appUrl,
      clientIdPreview: keyPreview,
      shopStatus,
      tokenValid,
      tokenError: tokenError ?? undefined,
      tokenAppApiKey: tokenAppApiKey ?? undefined,
      tokenAppTitle: tokenAppTitle ?? undefined,
      tokenAppDeveloperType: tokenAppDeveloperType ?? undefined,
      tokenAppCheckError: tokenAppCheckError ?? undefined,
      tokenMatchesOurApp: tokenAppApiKey != null ? tokenMatchesOurApp : undefined,
      canBill,
      nextStep,
    };
  }

  /**
   * GET /api/auth?shop=store.myshopify.com
   * Redirects to Shopify OAuth. If already installed, can redirect to app instead.
   */
  @Get()
  async install(@Query('shop') shop: string, @Res() res: Response) {
    if (!shop?.trim()) {
      res.status(400).send('Missing shop parameter');
      return;
    }
    const shopNorm = this.normalizeShop(shop);
    const redirectUri = this.config.get<string>('SHOPIFY_APP_URL')!.replace(/\/$/, '') + '/api/auth/callback';
    const scopes = this.config.get<string>('SHOPIFY_SCOPES') || 'read_products,read_orders,read_themes';
    const clientId = this.config.get<string>('SHOPIFY_API_KEY');
    const state = this.auth.generateState(shopNorm);
    const url = `https://${shopNorm}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId!)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    res.redirect(url);
  }

  /**
   * GET /api/auth/callback?code=...&shop=...&state=...&hmac=...
   * Exchanges code for access token and stores shop. HMAC verified per Shopify docs.
   */
  @Get('callback')
  async callback(@Query() query: Record<string, string>, @Res() res: Response) {
    const code = query.code;
    const shop = query.shop;
    const state = query.state;
    if (!code || !shop?.trim()) {
      res.status(400).send('Missing code or shop');
      return;
    }
    if (!this.auth.verifyCallbackHmac(query)) {
      res.status(400).send('Invalid HMAC');
      return;
    }
    const shopNorm = this.normalizeShop(shop);
    if (!this.auth.consumeState(state, shopNorm)) {
      res.status(400).send('Invalid or expired state');
      return;
    }
    const { access_token, scope } = await this.auth.exchangeCode(shopNorm, code);
    await this.auth.saveShopAndToken(shopNorm, access_token, scope);
    const redirectToApp = `https://${shopNorm}/admin/apps/${this.config.get<string>('SHOPIFY_API_KEY')}`;
    res.redirect(redirectToApp);
  }

  private normalizeShop(shop: string): string {
    const s = shop.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    return s.includes('.myshopify.com') ? s : `${s}.myshopify.com`;
  }
}
