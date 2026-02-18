import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  List,
  Divider,
  Box,
  InlineGrid,
} from '@shopify/polaris';
import { getBillingStatus, getApiUrl } from '../lib/api';

export default function UpgradePage() {
  const router = useRouter();
  const shop = (router.query.shop as string) || '';
  const [status, setStatus] = useState<{ subscribed: boolean; upgradeUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;
    getBillingStatus(shop)
      .then((res) => {
        setStatus({ subscribed: res.subscribed, upgradeUrl: res.upgradeUrl });
      })
      .catch(() => setStatus({ subscribed: false }))
      .finally(() => setLoading(false));
  }, [shop]);

  const subscribeUrl = status?.upgradeUrl || (shop ? `${getApiUrl().replace(/\/$/, '')}/api/billing/subscribe?shop=${encodeURIComponent(shop)}` : '');

  if (!shop && !loading) {
    return (
      <Page title="Upgrade">
        <Card>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              Missing shop. Open this app from your Shopify admin.
            </Text>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  if (loading || status === null) {
    return (
      <Page title="Upgrade">
        <Card>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">Loading…</Text>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  if (status.subscribed) {
    return (
      <Page title="Your plan">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Conversion Optimizer — $19/month
                  </Text>
                  <Badge tone="success">Active</Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  You have full access to scans, recommendations, and theme improvements.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Upgrade to Conversion Optimizer"
      subtitle="One plan. Full access. Cancel anytime."
    >
      <BlockStack gap="600">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center" gap="400">
                  <div>
                    <Text as="h2" variant="headingLg">
                      Conversion Optimizer Plan
                    </Text>
                    <Text as="p" tone="subdued">
                      Everything you need to turn more visitors into customers.
                    </Text>
                  </div>
                  <Box paddingBlockEnd="200">
                    <Text as="p" variant="headingXl">
                      $19
                      <Text as="span" variant="bodyMd" tone="subdued">
                        /month
                      </Text>
                    </Text>
                  </Box>
                </InlineStack>
                <Divider />
                <Text as="h3" variant="headingMd">
                  What you get
                </Text>
                <List type="bullet">
                  <List.Item>
                    <strong>Store scan</strong> — Automated audit of products, trust signals, and checkout flow.
                  </List.Item>
                  <List.Item>
                    <strong>Prioritized recommendations</strong> — Actionable fixes ordered by impact (trust, shipping, FAQs, contact).
                  </List.Item>
                  <List.Item>
                    <strong>Theme blocks</strong> — Add trust badges, guarantees, shipping info, and FAQs where they convert best.
                  </List.Item>
                  <List.Item>
                    <strong>Ongoing updates</strong> — New rules and best practices as we improve the optimizer.
                  </List.Item>
                </List>
                <Box paddingBlockStart="300">
                  <Button
                    variant="primary"
                    size="large"
                    url={subscribeUrl}
                  >
                    Subscribe for $19/month
                  </Button>
                </Box>
                <Text as="p" variant="bodySm" tone="subdued">
                  You’ll be charged through Shopify. Cancel anytime from your Shopify billing settings.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Why Conversion Optimizer?
                </Text>
                <Text as="p" tone="subdued">
                  Most stores leave conversion on the table: missing trust above the fold, unclear shipping, or weak CTAs.
                  We scan your store and tell you exactly what to fix—and where—so you can implement changes with confidence.
                </Text>
                <Text as="p" tone="subdued">
                  One low monthly price. No usage caps. Built for Shopify.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
