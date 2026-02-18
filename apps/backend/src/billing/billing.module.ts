import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaidPlanGuard } from './guards/paid-plan.guard';
import { ShopsModule } from '../shops/shops.module';

@Module({
  imports: [ShopsModule],
  controllers: [BillingController],
  providers: [BillingService, PaidPlanGuard],
  exports: [BillingService, PaidPlanGuard],
})
export class BillingModule {}
