import React from 'react';
import { Banner } from '@shopify/polaris';

interface UpgradeBannerProps {
  shop: string;
  upgradeUrl: string;
  onDismiss?: () => void;
}

export function UpgradeBanner({ shop, upgradeUrl, onDismiss }: UpgradeBannerProps) {
  const subscribeUrl = upgradeUrl || (typeof window !== 'undefined'
    ? `${window.location.origin.replace(/\/$/, '')}/api/billing/subscribe?shop=${encodeURIComponent(shop)}`
    : '#');

  return (
    <Banner
      title="Unlock Conversion Optimizer"
      tone="info"
      onDismiss={onDismiss}
      action={{
        content: 'Subscribe for $19/month',
        url: subscribeUrl,
      }}
    >
      <p>
        Run store scans, view prioritized recommendations, and apply fixes to increase conversions.
        Subscribe once to access all features.
      </p>
    </Banner>
  );
}
