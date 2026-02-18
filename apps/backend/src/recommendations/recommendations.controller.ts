import { Controller, Get, Param, Query } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { ShopsService } from '../shops/shops.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationsService,
    private readonly shops: ShopsService,
  ) {}

  /** GET /api/recommendations/:shopDomain?limit=10 — top recommendations for shop. */
  @Get(':shopDomain')
  async list(
    @Param('shopDomain') shopDomain: string,
    @Query('limit') limit?: string,
  ) {
    const shop = await this.shops.getByDomain(shopDomain.replace(/%2E/g, '.').toLowerCase().trim());
    const n = Math.min(parseInt(limit || '20', 10) || 20, 100);
    return this.recommendations.findByShop(shop.id, n);
  }
}
