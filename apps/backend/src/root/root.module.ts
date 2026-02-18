import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { ShopsModule } from '../shops/shops.module';

@Module({
  imports: [ShopsModule],
  controllers: [RootController],
})
export class RootModule {}
