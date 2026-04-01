import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Icon,
  EmptyState,
  List,
} from "@shopify/polaris";
import { 
  ImagesIcon, 
  PaintBrushFlatIcon, 
  LayoutColumns2Icon,
  PlusIcon
} from "@shopify/polaris-icons";

import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  const [templateCount, designCount, categoryCount] = await Promise.all([
    prisma.tShirtTemplate.count(),
    prisma.printDesign.count(),
    prisma.designCategory.count(),
  ]);

  return json({
    stats: {
      templates: templateCount,
      designs: designCount,
      categories: categoryCount,
    }
  });
};

export default function Index() {
  const { stats } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page fullWidth>
      <TitleBar title="Vibenaura Dashboard" />
      <BlockStack gap="500">
        <Layout>
          {/* Summary Stats */}
          <Layout.Section>
            <InlineStack gap="400" align="start">
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200" align="center">
                    <Icon source={LayoutColumns2Icon} tone="base" />
                    <Text variant="headingLg" as="p">{stats.templates}</Text>
                    <Text variant="bodyMd" tone="subdued" as="p">T-Shirt Bases</Text>
                  </BlockStack>
                </Card>
              </div>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200" align="center">
                    <Icon source={PaintBrushFlatIcon} tone="base" />
                    <Text variant="headingLg" as="p">{stats.designs}</Text>
                    <Text variant="bodyMd" tone="subdued" as="p">Print Designs</Text>
                  </BlockStack>
                </Card>
              </div>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200" align="center">
                    <Icon source={ImagesIcon} tone="base" />
                    <Text variant="headingLg" as="p">{stats.categories}</Text>
                    <Text variant="bodyMd" tone="subdued" as="p">Categories</Text>
                  </BlockStack>
                </Card>
              </div>
            </InlineStack>
          </Layout.Section>

          {/* Core Management Sections */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Garment Templates</Text>
                  <Button 
                    icon={PlusIcon} 
                    variant="tertiary" 
                    onClick={() => navigate("/app/templates/new")}
                  >
                    New Base
                  </Button>
                </InlineStack>
                <Text variant="bodyMd" as="p">
                  Manage your library of t-shirt bases, including body measurements, sizing, and color variants used in the 3D customizer.
                </Text>
                <Button onClick={() => navigate("/app/templates")}>
                  Manage Templates
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Design Registry</Text>
                  <Button 
                    icon={PlusIcon} 
                    variant="tertiary" 
                    onClick={() => navigate("/app/designs/new")}
                  >
                    New Design
                  </Button>
                </InlineStack>
                <Text variant="bodyMd" as="p">
                  Organize your print assets. Upload high-res designs to Spotify Files and categorize them for easier merchant discovery.
                </Text>
                <Button onClick={() => navigate("/app/designs")}>
                   Explore Gallery
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                   <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">System Status</Text>
                    <List>
                      <List.Item><b>Assets:</b> 100% Hosted on Shopify Files (Secure CDN)</List.Item>
                      <List.Item><b>Public API:</b> Templates and Designs endpoints available for storefront integration</List.Item>
                      <List.Item><b>3D Engine:</b> Ready for garment mapping</List.Item>
                    </List>
                   </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {stats.templates === 0 && stats.designs === 0 && (
            <Layout.Section>
              <EmptyState
                heading="Set up your Vibenaura customization engine"
                action={{
                  content: 'Create your first template',
                  onAction: () => navigate("/app/templates/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Start by adding your garment bases and high-res print designs to enable the customizer on your storefront.</p>
              </EmptyState>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}

