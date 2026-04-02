import { Response } from 'express';
import { LandingService } from './landing.service';
export declare class LandingController {
    private readonly landing;
    constructor(landing: LandingService);
    newsletter(email: string, returnTo: string, res: Response): Promise<void>;
}
