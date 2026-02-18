import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { ShopsService } from '../shops/shops.service';
import { PaidPlanGuard } from '../billing/guards/paid-plan.guard';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationsService,
    private readonly shops: ShopsService,
  ) {}

  /** GET /api/recommendations/:shopDomain?limit=10 — top recommendations for shop. Requires paid plan. */
  @Get(':shopDomain')
  @UseGuards(PaidPlanGuard)
  async list(
    @Param('shopDomain') shopDomain: string,
    @Query('limit') limit?: string,
  ) {
    const shop = await this.shops.getByDomain(shopDomain.replace(/%2E/g, '.').toLowerCase().trim());
    const n = Math.min(parseInt(limit || '20', 10) || 20, 100);
    return this.recommendations.findByShop(shop.id, n);
  }
}
