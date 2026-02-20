import { Controller, Post, Get, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { ScanService } from './scan.service';
import { PaidPlanGuard, REQUEST_SHOP_KEY } from '../billing/guards/paid-plan.guard';
import type { Shop } from '../shops/entities/shop.entity';

@Controller('scan')
export class ScanController {
  constructor(private readonly scan: ScanService) {}

  /** POST /api/scan/:shopDomain — enqueue scan for shop. Requires paid plan. */
  @Post(':shopDomain')
  @UseGuards(PaidPlanGuard)
  async start(@Req() req: Request & { [REQUEST_SHOP_KEY]?: Shop }) {
    const shop = req[REQUEST_SHOP_KEY];
    if (!shop) throw new Error('PaidPlanGuard should have set shop');
    return this.scan.enqueueScan(shop.id);
  }

  /** GET /api/scan/job/:jobId — get scan job status. */
  @Get('job/:jobId')
  async jobStatus(@Param('jobId') jobId: string) {
    return this.scan.getJobStatus(jobId);
  }
}
