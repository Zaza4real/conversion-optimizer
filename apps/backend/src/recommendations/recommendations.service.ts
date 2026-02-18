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
    return this.recRepo.find({
      where: { shopId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
