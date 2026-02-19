import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { LandingService } from './landing.service';

@Controller('landing')
export class LandingController {
  constructor(private readonly landing: LandingService) {}

  /**
   * POST /api/landing/newsletter
   * Form body: email (required), return_to (optional URL to redirect after).
   * Saves signup and optionally sends notification to NEWSLETTER_NOTIFY_EMAIL.
   * Responds with 303 redirect to return_to?newsletter=success (or &newsletter=invalid on bad email).
   */
  @Post('newsletter')
  async newsletter(
    @Body('email') email: string,
    @Body('return_to') returnTo: string,
    @Res() res: Response,
  ): Promise<void> {
    const { redirect } = await this.landing.subscribeNewsletter(email ?? '', returnTo ?? '');
    res.redirect(303, redirect);
  }
}
