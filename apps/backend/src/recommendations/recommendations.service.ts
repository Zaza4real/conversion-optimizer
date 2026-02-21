import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recommendation } from './entities/recommendation.entity';

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Recommendation)
    private readonly recRepo: Repository<Recommendation>,
  ) {}

  async findByShop(shopId: string, limit: number): Promise<Recommendation[]> {
    return this.recRepo
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.category',
        'r.ruleId',
        'r.severity',
        'r.rationale',
        'r.expectedImpact',
      ])
      .where('r.shopId = :shopId', { shopId })
      .orderBy('r.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
