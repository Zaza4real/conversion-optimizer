import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { ShopsModule } from '../shops/shops.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [ShopsModule, BillingModule],
  controllers: [RootController],
})
export class RootModule {}
