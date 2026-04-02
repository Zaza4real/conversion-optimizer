import { Repository } from 'typeorm';
import { Recommendation } from './entities/recommendation.entity';
export declare class RecommendationsService {
    private readonly recRepo;
    constructor(recRepo: Repository<Recommendation>);
    findByShop(shopId: string, limit: number): Promise<Recommendation[]>;
}
