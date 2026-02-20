import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { RecommendationsService } from './recommendations.service';
import { PaidPlanGuard, REQUEST_SHOP_KEY } from '../billing/guards/paid-plan.guard';
import { getRuleById } from '../cro-rules/rule-registry';
import type { Shop } from '../shops/entities/shop.entity';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  /** GET /api/recommendations/:shopDomain?limit=10 — top recommendations for shop. Requires paid plan. */
  @Get(':shopDomain')
  @UseGuards(PaidPlanGuard)
  async list(
    @Req() req: Request & { [REQUEST_SHOP_KEY]?: Shop },
    @Param('shopDomain') _shopDomain: string,
    @Query('limit') limit?: string,
  ) {
    const shop = req[REQUEST_SHOP_KEY];
    if (!shop) throw new Error('PaidPlanGuard should have set shop');
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
