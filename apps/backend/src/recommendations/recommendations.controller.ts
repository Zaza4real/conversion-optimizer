import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { ShopsService } from '../shops/shops.service';
import { PaidPlanGuard } from '../billing/guards/paid-plan.guard';
import { getRuleById } from '../cro-rules/rule-registry';

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
    const list = await this.recommendations.findByShop(shop.id, n);
    return list.map((rec) => {
      const rule = getRuleById(rec.ruleId);
      return {
        id: rec.id,
        category: rec.category,
        severity: rec.severity,
        rationale: rec.rationale,
        expectedImpact: rec.expectedImpact ?? undefined,
        title: rule?.title ?? rec.category,
      };
    });
  }
}
