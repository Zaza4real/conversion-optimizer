import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ShopsService } from '../../shops/shops.service';

export const PAID_PLAN_SKIP = 'paid_plan_skip';

/** Use @SkipPaidPlan() on a route to allow access without a paid plan. */
export const SkipPaidPlan = () => SetMetadata(PAID_PLAN_SKIP, true);

/**
 * Guard that ensures the request is for a shop with an active paid plan.
 * Expects shop domain from param :shopDomain (e.g. scan/:shopDomain, recommendations/:shopDomain).
 */
@Injectable()
export class PaidPlanGuard implements CanActivate {
  constructor(
    private readonly shops: ShopsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>(PAID_PLAN_SKIP, context.getHandler())) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const shopDomain =
      request.params?.shopDomain?.replace(/%2E/g, '.').toLowerCase().trim();
    if (!shopDomain) return false;
    try {
      const shop = await this.shops.getByDomain(shopDomain);
      if (this.shops.hasPaidPlan(shop)) return true;
      throw new HttpException(
        {
          error: 'Subscription required',
          message:
            'Upgrade to run scans and view recommendations. Choose a plan from the app home.',
          upgradeUrl: `/api/billing/subscribe?shop=${encodeURIComponent(shop.domain)}`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: 'Shop not found', message: 'Invalid shop.' },
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
