import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useNavigate, useSubmit, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
  Thumbnail,
  InlineStack,
  EmptyState,
  BlockStack,
  Box,
  IndexFilters,
  useSetIndexFiltersMode,
  type IndexFiltersProps,
  ChoiceList,
  Modal,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const designs = await prisma.printDesign.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  const designCategories = await prisma.designCategory.findMany({
    orderBy: { name: "asc" },
  });
  return json({ designs, categories: designCategories });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const ids = JSON.parse(formData.get("ids") as string) as string[];

  if (!ids || ids.length === 0) {
    return json({ error: "No designs selected" }, { status: 400 });
  }

  try {
    switch (actionType) {
      case "enable":
        await prisma.printDesign.updateMany({
          where: { id: { in: ids } },
          data: { status: "ENABLED" },
        });
        break;
      case "disable":
        await prisma.printDesign.updateMany({
          where: { id: { in: ids } },
          data: { status: "DISABLED" },
        });
        break;
      case "delete":
        await prisma.printDesign.deleteMany({
          where: { id: { in: ids } },
        });
        break;
      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
    return json({ success: true });
  } catch (error) {
    console.error("Bulk action failed", error);
    return json({ error: "Bulk action failed" }, { status: 500 });
  }
};

export default function DesignsIndex() {
  const { designs, categories } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      shopify.toast.show("Design created successfully!", { duration: 3000 });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("success");
      setSearchParams(newParams, { replace: true });
    } else if (searchParams.get("shadow") === "true") {
      shopify.toast.show("Design already exists. Redirected to gallery.", { duration: 3000 });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("shadow");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  // --- Filtering State ---
  const [queryValue, setQueryValue] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [category, setCategory] = useState<string[]>([]);
  const { mode, setMode } = useSetIndexFiltersMode();
  const [activePreview, setActivePreview] = useState<any>(null);

  const handleQueryValueChange = useCallback((value: string) => setQueryValue(value), []);
  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);
  const handleStatusChange = useCallback((value: string[]) => setStatus(value), []);
  const handleCategoryChange = useCallback((value: string[]) => setCategory(value), []);
  
  const handleStatusRemove = useCallback(() => setStatus([]), []);
  const handleCategoryRemove = useCallback(() => setCategory([]), []);
  const handleFiltersClearAll = useCallback(() => {
    handleStatusRemove();
    handleCategoryRemove();
    handleQueryValueRemove();
  }, [handleStatusRemove, handleCategoryRemove, handleQueryValueRemove]);

  // --- Filtered Designs ---
  const filteredDesigns = designs.filter((design: any) => {
    const matchesQuery = design.name.toLowerCase().includes(queryValue.toLowerCase()) || 
                        design.tags?.toLowerCase().includes(queryValue.toLowerCase());
    const matchesStatus = status.length === 0 || status.includes(design.status);
    const matchesCategory = category.length === 0 || category.includes(design.categoryId || "uncategorized");
    
    return matchesQuery && matchesStatus && matchesCategory;
  });

  const resourceName = {
    singular: "design",
    plural: "designs",
  };

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(filteredDesigns as any);

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: 'Active', value: 'ENABLED' },
            { label: 'Disabled', value: 'DISABLED' },
          ]}
          selected={status || []}
          onChange={handleStatusChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: 'category',
      label: 'Category',
      filter: (
        <ChoiceList
          title="Category"
          titleHidden
          choices={[
            { label: 'Uncategorized', value: 'uncategorized' },
            ...categories.map((c: any) => ({ label: c.name, value: c.id }))
          ]}
          selected={category || []}
          onChange={handleCategoryChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters: IndexFiltersProps['appliedFilters'] = [];
  if (status.length > 0) {
    appliedFilters.push({
      key: 'status',
      label: `Status: ${status.join(', ')}`,
      onRemove: handleStatusRemove,
    });
  }
  if (category.length > 0) {
    appliedFilters.push({
      key: 'category',
      label: `Category selected`,
      onRemove: handleCategoryRemove,
    });
  }

  const handleBulkAction = useCallback((actionType: string) => {
    submit(
      { actionType, ids: JSON.stringify(selectedResources) },
      { method: "POST" }
    );
    clearSelection();
  }, [selectedResources, submit, clearSelection]);

  const promotedBulkActions = [
    {
      content: 'Enable designs',
      onAction: () => handleBulkAction('enable'),
    },
    {
      content: 'Disable designs',
      onAction: () => handleBulkAction('disable'),
    },
  ];

  const bulkActions = [
    {
      content: 'Delete designs',
      onAction: () => handleBulkAction('delete'),
    },
  ];

  return (
    <Page fullWidth>
      <TitleBar title="Print Gallery">
        <button variant="primary" onClick={() => navigate("/app/designs/new")}>
          Add Design
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {designs.length === 0 ? (
              <EmptyState
                heading="Organize your print art"
                action={{
                  content: "Add design",
                  onAction: () => navigate("/app/designs/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Upload and categorize your print designs for the 3D garments.</p>
              </EmptyState>
            ) : (
              <BlockStack gap="0">
                <IndexFilters
                  queryValue={queryValue}
                  queryPlaceholder="Searching in designs..."
                  onQueryChange={handleQueryValueChange}
                  onQueryClear={handleQueryValueRemove}
                  onClearAll={handleFiltersClearAll}
                  cancelAction={{
                    onAction: handleFiltersClearAll,
                    disabled: false,
                    loading: false,
                  }}
                  tabs={[]}
                  selected={0}
                  onSelect={() => {}}
                  filters={filters}
                  appliedFilters={appliedFilters}
                  mode={mode}
                  setMode={setMode}
                />
                <IndexTable
                  resourceName={resourceName}
                  itemCount={filteredDesigns.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Preview" },
                    { title: "Design" },
                    { title: "Category" },
                    { title: "Status" },
                    { title: "Tags" },
                  ]}
                  promotedBulkActions={promotedBulkActions}
                  bulkActions={bulkActions}
                >
                  {filteredDesigns.map((design: any, index) => (
                    <IndexTable.Row
                      id={design.id}
                      key={design.id}
                      selected={selectedResources.includes(design.id)}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePreview(design);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <Thumbnail
                            source={design.imageUrl || "https://polaris.shopify.com/images/no-image.svg"}
                            alt={design.name}
                            size="small"
                          />
                        </div>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Link to={`/app/designs/${design.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {design.name}
                          </Text>
                        </Link>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" as="span">
                          {design.category?.name || "Uncategorized"}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={design.status === "ENABLED" ? "success" : "warning"}>
                          {design.status === "ENABLED" ? "Active" : "Disabled"}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <InlineStack gap="100">
                          {design.tags?.split(",").filter(Boolean).map((tag: string) => (
                            <Badge key={tag} tone="info">{tag.trim()}</Badge>
                          ))}
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </BlockStack>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Gallery Overview</Text>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p">Total Designs</Text>
                  <Text variant="bodyMd" as="p" fontWeight="bold">{designs.length}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p">Active Categories</Text>
                  <Text variant="bodyMd" as="p" fontWeight="bold">{categories.length}</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Quick Tips</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Use high-resolution transparent PNGs for best results in the 3D garment customizers.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={!!activePreview}
        onClose={() => setActivePreview(null)}
        title={activePreview?.name || "Design Preview"}
        primaryAction={{
          content: "Edit Design",
          onAction: () => navigate(`/app/designs/${activePreview?.id}`),
        }}
        secondaryActions={[
          {
            content: "Close",
            onAction: () => setActivePreview(null),
          },
        ]}
      >
        <Modal.Section>
          <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f4f4f4', borderRadius: '8px', padding: '20px' }}>
             <img 
               src={activePreview?.imageUrl} 
               alt={activePreview?.name} 
               style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} 
             />
          </div>
          {activePreview?.tags && (
             <Box paddingBlockStart="400">
                <InlineStack gap="200">
                   {activePreview.tags.split(",").map((tag: string) => (
                      <Badge key={tag} tone="info">{tag.trim()}</Badge>
                   ))}
                </InlineStack>
             </Box>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
