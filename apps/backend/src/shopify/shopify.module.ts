import { Module } from '@nestjs/common';
import { ShopifyApiService } from './shopify-api.service';

@Module({
  providers: [ShopifyApiService],
  exports: [ShopifyApiService],
})
export class ShopifyModule {}
