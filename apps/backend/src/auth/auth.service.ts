import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { ShopsService } from '../shops/shops.service';

const STATE_TTL_MS = 600_000; // 10 min
const stateStore = new Map<string, { shop: string; expires: number }>();

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly shops: ShopsService,
  ) {}

  generateState(shop: string): string {
    const state = randomBytes(16).toString('hex');
    stateStore.set(state, { shop, expires: Date.now() + STATE_TTL_MS });
    return state;
  }

  /** Verify Shopify callback: remove hmac, sort params, HMAC-SHA256 with client secret. */
  verifyCallbackHmac(query: Record<string, string>): boolean {
    const hmac = query.hmac;
    if (!hmac) return false;
    const sorted = Object.keys(query)
      .filter((k) => k !== 'hmac')
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join('&');
    const secret = this.config.get<string>('SHOPIFY_API_SECRET');
    const expected = createHmac('sha256', secret!).update(sorted).digest('hex');
    return expected === hmac;
  }

  /** Verify state was issued by us and not expired. */
  consumeState(state: string, shop: string): boolean {
    const entry = stateStore.get(state);
    if (!entry || entry.shop !== shop || entry.expires < Date.now()) return false;
    stateStore.delete(state);
    return true;
  }

  async exchangeCode(shop: string, code: string): Promise<{ access_token: string; scope?: string }> {
    const clientId = this.config.get<string>('SHOPIFY_API_KEY');
    const clientSecret = this.config.get<string>('SHOPIFY_API_SECRET');
    const redirectUri = this.config.get<string>('SHOPIFY_APP_URL')!.replace(/\/$/, '') + '/api/auth/callback';
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return { access_token: data.access_token, scope: data.scope };
  }

  async saveShopAndToken(shop: string, accessToken: string, scope?: string): Promise<void> {
    await this.shops.upsertWithToken(shop, accessToken, scope);
  }
}
