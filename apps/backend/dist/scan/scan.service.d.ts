import { Queue } from 'bullmq';
import { ScanJobPayload } from './scan.processor';
export declare class ScanService {
    private readonly scanQueue;
    constructor(scanQueue: Queue<ScanJobPayload>);
    enqueueScan(shopId: string): Promise<{
        jobId: string;
    }>;
    getJobStatus(jobId: string): Promise<{
        status: string;
        result?: unknown;
    }>;
}
