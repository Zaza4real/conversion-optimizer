import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { NewsletterSignup } from './entities/newsletter-signup.entity';
export declare class LandingService {
    private readonly newsletterRepo;
    private readonly config;
    constructor(newsletterRepo: Repository<NewsletterSignup>, config: ConfigService);
    subscribeNewsletter(email: string, returnTo: string): Promise<{
        redirect: string;
    }>;
}
