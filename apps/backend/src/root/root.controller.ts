import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Handles GET / (Shopify install request). Excluded from global "api" prefix.
 * Redirects to /api/auth?shop=... so OAuth flow starts.
 */
@Controller()
export class RootController {
  @Get()
  redirectToAuth(@Req() req: Request, @Res() res: Response) {
    const shop = (req.query.shop as string)?.trim();
    if (!shop) {
      res.status(400).send('Missing shop parameter. Use /api/auth?shop=your-store.myshopify.com');
      return;
    }
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    res.redirect(302, `/api/auth?${query}`);
  }
}
