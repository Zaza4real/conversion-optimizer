import { Controller, Post, Get, Param } from '@nestjs/common';
import { ScanService } from './scan.service';
import { ShopsService } from '../shops/shops.service';

@Controller('scan')
export class ScanController {
  constructor(
    private readonly scan: ScanService,
    private readonly shops: ShopsService,
  ) {}

  /** POST /api/scan/:shopDomain — enqueue scan for shop. In production, resolve shop from session. */
  @Post(':shopDomain')
  async start(@Param('shopDomain') shopDomain: string) {
    const shop = await this.shops.getByDomain(shopDomain.replace(/%2E/g, '.').toLowerCase().trim());
    return this.scan.enqueueScan(shop.id);
  }

  /** GET /api/scan/job/:jobId — get scan job status. */
  @Get('job/:jobId')
  async jobStatus(@Param('jobId') jobId: string) {
    return this.scan.getJobStatus(jobId);
  }
}
