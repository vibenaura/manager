import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useNavigate, useSearchParams, useSubmit } from "@remix-run/react";
import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Thumbnail,
  InlineStack,
  EmptyState,
  useIndexResourceState,
  Box,
  IndexFilters,
  useSetIndexFiltersMode,
  type IndexFiltersProps,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const templates = await prisma.tShirtTemplate.findMany({
    include: {
      _count: {
        select: { colorVariants: true }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ templates });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const ids = JSON.parse(formData.get("ids") as string) as string[];

  if (!ids || ids.length === 0) {
    return json({ error: "No templates selected" }, { status: 400 });
  }

  try {
    if (actionType === "delete") {
      await prisma.tShirtTemplate.deleteMany({
        where: { id: { in: ids } },
      });
    }
    return json({ success: true });
  } catch (error) {
    console.error("Bulk action failed", error);
    return json({ error: "Bulk action failed" }, { status: 500 });
  }
};

export default function TemplatesIndex() {
  const { templates } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      shopify.toast.show("T-Shirt template created successfully!", { duration: 3000 });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("success");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // --- Filtering & Tab State ---
  const [queryValue, setQueryValue] = useState("");
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    {
      id: "all-templates",
      content: "All",
      accessibilityLabel: "All templates",
      panelID: "all-templates-panel",
    },
  ];

  const handleQueryValueChange = useCallback((value: string) => setQueryValue(value), []);
  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);

  const resourceName = {
    singular: "template",
    plural: "templates",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(templates);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(queryValue.toLowerCase()) ||
    t.tags?.toLowerCase().includes(queryValue.toLowerCase())
  );

  const handleBulkAction = useCallback((actionType: string) => {
    submit(
      { actionType, ids: JSON.stringify(selectedResources) },
      { method: "POST" }
    );
    clearSelection();
  }, [selectedResources, submit, clearSelection]);

  const bulkActions = [
    {
      content: 'Delete templates',
      onAction: () => handleBulkAction('delete'),
    },
  ];

  const rowMarkup = filteredTemplates.map(
    (template, index) => (
      <IndexTable.Row
        id={template.id}
        key={template.id}
        selected={selectedResources.includes(template.id)}
        position={index}
        onClick={() => navigate(`/app/templates/${template.id}`)}
      >
        <IndexTable.Cell>
          <Thumbnail
            source={template.frontImage || "https://polaris.shopify.com/images/no-image.svg"}
            alt={template.name}
            size="small"
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Link to={`/app/templates/${template.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {template.name}
            </Text>
          </Link>
        </IndexTable.Cell>
        <IndexTable.Cell>{template.sizes}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">{`${template._count.colorVariants} colors`.toString()}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            {template.tags?.split(",").slice(0, 3).map((tag) => (
              <Badge key={tag} size="small">{tag.trim()}</Badge>
            ))}
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(template.createdAt).toLocaleDateString()}
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page fullWidth>
      <TitleBar title="T-Shirt Templates">
        <button variant="primary" onClick={() => navigate("/app/templates/new")}>
          Create template
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {templates.length === 0 ? (
              <EmptyState
                heading="Manage your T-shirt templates"
                action={{
                  content: "Create template",
                  onAction: () => navigate("/app/templates/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Track and manage your t-shirt bases for the 3D customizer.</p>
              </EmptyState>
            ) : (
              <Box>
                <IndexFilters
                  queryValue={queryValue}
                  queryPlaceholder="Search templates..."
                  onQueryChange={handleQueryValueChange}
                  onQueryClear={handleQueryValueRemove}
                  cancelAction={{
                    onAction: handleQueryValueRemove,
                    disabled: false,
                    loading: false,
                  }}
                  tabs={tabs}
                  selected={selectedTab}
                  onSelect={setSelectedTab}
                  filters={[]}
                  onClearAll={() => { }}
                  mode={mode}
                  setMode={setMode}
                />
                <IndexTable
                  resourceName={resourceName}
                  itemCount={templates.length}
                  selectedItemsCount={
                    allResourcesSelected ? 'All' : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  bulkActions={bulkActions}
                  headings={[
                    { title: 'Preview' },
                    { title: 'Name' },
                    { title: 'Sizes' },
                    { title: 'Variants' },
                    { title: 'Tags' },
                    { title: 'Created' },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              </Box>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
