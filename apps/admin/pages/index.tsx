import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
} from '@shopify/polaris';
import { getBillingStatus, getApiUrl } from '../lib/api';
import { UpgradeBanner } from '../components/UpgradeBanner';

export default function Home() {
  const router = useRouter();
  const shop = (router.query.shop as string) || '';
  const [billing, setBilling] = useState<{
    subscribed: boolean;
    upgradeUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (!shop) return;
    getBillingStatus(shop)
      .then((res) => setBilling({ subscribed: res.subscribed, upgradeUrl: res.upgradeUrl }))
      .catch(() => setBilling({ subscribed: false }));
  }, [shop]);

  const showUpgrade = billing && !billing.subscribed;
  const apiUrl = getApiUrl();

  return (
    <Page title="Conversion Optimizer">
      <BlockStack gap="400">
        {showUpgrade && shop && (
          <UpgradeBanner
            shop={shop}
            upgradeUrl={billing.upgradeUrl || `${apiUrl.replace(/\/$/, '')}/api/billing/subscribe?shop=${encodeURIComponent(shop)}`}
          />
        )}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Dashboard
                </Text>
                {billing === null ? (
                  <Text as="p" tone="subdued">
                    Loading…
                  </Text>
                ) : billing.subscribed ? (
                  <>
                    <Text as="p" tone="subdued">
                      You’re all set. Run a store scan to get prioritized recommendations, or open the Upgrade page to manage your plan.
                    </Text>
                    <InlineStack gap="300">
                      <Button url={shop ? `/upgrade?shop=${encodeURIComponent(shop)}` : undefined}>
                        View plan
                      </Button>
                    </InlineStack>
                  </>
                ) : (
                  <>
                    <Text as="p" tone="subdued">
                      Subscribe to run store scans and unlock recommendations. One plan, full access.
                    </Text>
                    <InlineStack gap="300">
                      <Button variant="primary" url={shop ? `/upgrade?shop=${encodeURIComponent(shop)}` : undefined}>
                        See plan & pricing
                      </Button>
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
