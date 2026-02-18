import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ScanJobPayload, SCAN_QUEUE } from './scan.processor';

@Injectable()
export class ScanService {
  constructor(
    @InjectQueue(SCAN_QUEUE)
    private readonly scanQueue: Queue<ScanJobPayload>,
  ) {}

  async enqueueScan(shopId: string): Promise<{ jobId: string }> {
    const job = await this.scanQueue.add('scan', { shopId }, { jobId: `scan-${shopId}-${Date.now()}` });
    return { jobId: job.id! };
  }

  async getJobStatus(jobId: string): Promise<{ status: string; result?: unknown }> {
    const job = await this.scanQueue.getJob(jobId);
    if (!job) return { status: 'unknown' };
    const state = await job.getState();
    return { status: state, result: job.returnvalue };
  }
}
