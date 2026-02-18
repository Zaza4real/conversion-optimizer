import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { getTypeOrmConfig } from './config/typeorm.config';
import { CommonModule } from './common/common.module';
import { ShopsModule } from './shops/shops.module';
import { AuthModule } from './auth/auth.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ScanModule } from './scan/scan.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { RootModule } from './root/root.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRoot(getTypeOrmConfig()),
    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) },
    }),
    CommonModule,
    ShopsModule,
    AuthModule,
    WebhooksModule,
    ScanModule,
    RecommendationsModule,
    BillingModule,
    RootModule,
  ],
})
export class AppModule {}
