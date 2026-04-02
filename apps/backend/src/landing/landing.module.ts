import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsletterSignup } from './entities/newsletter-signup.entity';
import { LandingService } from './landing.service';
import { LandingController } from './landing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NewsletterSignup])],
  controllers: [LandingController],
  providers: [LandingService],
})
export class LandingModule {}
