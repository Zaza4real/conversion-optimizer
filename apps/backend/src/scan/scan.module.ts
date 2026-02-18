import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recommendation } from '../recommendations/entities/recommendation.entity';
import { ScanProcessor, SCAN_QUEUE } from './scan.processor';
import { ScanService } from './scan.service';
import { ScanController } from './scan.controller';
import { ShopsModule } from '../shops/shops.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recommendation]),
    BullModule.registerQueue({ name: SCAN_QUEUE }),
    ShopsModule,
    ShopifyModule,
    BillingModule,
  ],
  controllers: [ScanController],
  providers: [ScanProcessor, ScanService],
})
export class ScanModule {}
