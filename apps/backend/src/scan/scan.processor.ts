import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopsService } from '../shops/shops.service';
import { ShopifyApiService } from '../shopify/shopify-api.service';
import { Recommendation } from '../recommendations/entities/recommendation.entity';
import { runProductRules, runGlobalRules, priorityScore, getImpactMid, ThemeContext } from './scan-rules.evaluator';

export const SCAN_QUEUE = 'scan';

export interface ScanJobPayload {
  shopId: string;
}

@Processor(SCAN_QUEUE)
export class ScanProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Recommendation)
    private readonly recRepo: Repository<Recommendation>,
    private readonly shops: ShopsService,
    private readonly shopify: ShopifyApiService,
  ) {
    super();
  }

  async process(job: Job<ScanJobPayload>): Promise<{ recommendationsCreated: number }> {
    const { shopId } = job.data;
    const shop = await this.shops.getById(shopId);
    const domain = shop.domain;
    const token = this.shops.getAccessToken(shop);
    const products: import('../shopify/shopify-api.service').ProductNode[] = [];
    for await (const page of this.shopify.fetchProducts(domain, token, 4)) {
      products.push(...page);
    }
    const themeContext: ThemeContext = {
      hasBlock: () => false, // v1: we cannot read theme; assume blocks missing
    };
    const productRecs = runProductRules(products);
    const globalRecs = runGlobalRules(themeContext);
    const all = [...productRecs, ...globalRecs].map((r) => ({
      ...r,
      priority: priorityScore(r.rule, getImpactMid(r.rule)),
    }));
    all.sort((a, b) => b.priority - a.priority);
    await this.recRepo.delete({ shopId });
    const toInsert = all.slice(0, 50).map((r) =>
      this.recRepo.create({
        shopId,
        entityType: r.entityType,
        entityId: r.entityId,
        category: r.rule.category,
        ruleId: r.rule.id,
        severity: r.rule.severity,
        rationale: r.rule.description,
        expectedImpact: r.rule.impact_estimate ?? null,
        patchPayload: r.patchPayload,
        status: 'pending',
      }),
    );
    await this.recRepo.save(toInsert);
    return { recommendationsCreated: toInsert.length };
  }
}
