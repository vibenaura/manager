import { useState, useCallback, useMemo, useEffect } from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Text,
  DropZone,
  Thumbnail,
  Banner,
  Box,
  Select,
  Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { DeleteIcon } from "@shopify/polaris-icons";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { id } = params;

  if (!id) return redirect("/app/designs");

  const design = await prisma.printDesign.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!design) throw new Response("Not Found", { status: 404 });

  const categories = await prisma.designCategory.findMany({
    orderBy: { name: "asc" },
  });

  return json({ design, categories });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "delete") {
    await prisma.printDesign.delete({ where: { id } });
    return redirect("/app/designs");
  }

  const name = formData.get("name") as string;
  const imageUrl = formData.get("imageUrl") as string;
  const categoryId = formData.get("categoryId") as string;
  const newCategoryName = formData.get("newCategoryName") as string;
  const tags = formData.get("tags") as string;
  const status = formData.get("status") as string;

  if (!name || !imageUrl) {
    return json({ error: "Missing Name or Image" }, { status: 400 });
  }

  try {
    let finalCategoryId = categoryId;

    if (newCategoryName && !categoryId) {
      const existing = await prisma.designCategory.findUnique({
        where: { name: newCategoryName },
      });
      if (existing) {
        finalCategoryId = existing.id;
      } else {
        const createdCat = await prisma.designCategory.create({
          data: { name: newCategoryName },
        });
        finalCategoryId = createdCat.id;
      }
    }

    await prisma.printDesign.update({
      where: { id },
      data: {
        name,
        imageUrl,
        categoryId: finalCategoryId || null,
        tags,
        status,
      },
    });

    return json({ success: true });
  } catch (error) {
    console.error("Failed to update design", error);
    return json({ error: "Failed to update design" }, { status: 500 });
  }
};

// --- Custom Components ---

interface ImageUploadProps {
  label: string;
  name: string;
  value: string;
  onChange: (base64: string) => void;
  error?: string;
  required?: boolean;
}

function ImageUpload({ label, name, value, onChange, error, required }: ImageUploadProps) {
  const [file, setFile] = useState<File>();
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = useCallback(
    async (_droppedFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        setIsUploading(true);
        
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
             throw new Error("Upload failed");
          }

          const data = await response.json();
          if (data.url) {
            onChange(data.url);
          } else {
            throw new Error(data.error || "Failed to get upload URL");
          }
        } catch (err: any) {
          console.error("Upload failed", err);
          shopify.toast.show(err.message || "Failed to upload image", { isError: true });
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onChange],
  );

  const fileUpload = !value && !isUploading && <DropZone.FileUpload actionHint="SVG or High-res PNG" />;
  const loading = isUploading && (
    <Box padding="400">
      <InlineStack align="center" blockAlign="center" gap="400">
        <Text variant="bodyMd" as="p">Uploading to Shopify...</Text>
      </InlineStack>
    </Box>
  );
  const preview = value && (
    <Box padding="400">
      <InlineStack align="center" blockAlign="center" gap="400">
        <Thumbnail
          size="large"
          alt="Design Preview"
          source={value}
        />
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="bold" as="p">
            {file?.name || "Image Preview"}
          </Text>
          <Button variant="tertiary" onClick={() => {
            setFile(undefined);
            onChange("");
          }} disabled={isUploading}>
            Remove
          </Button>
        </BlockStack>
      </InlineStack>
    </Box>
  );

  return (
    <BlockStack gap="200">
      <InlineStack align="space-between">
        <Text variant="bodyMd" as="p" fontWeight={required ? "bold" : "regular"}>
          {label} {required && <span style={{ color: "red" }}>*</span>}
        </Text>
      </InlineStack>
      <div style={{
        border: `2px dashed ${error ? "#d72c0d" : "#c9cccf"}`,
        borderRadius: "8px",
        overflow: "hidden"
      }}>
        <DropZone
          onDrop={handleDrop}
          accept="image/*"
          type="image"
          allowMultiple={false}
          error={!!error}
          disabled={isUploading}
        >
          {preview}
          {loading}
          {fileUpload}
        </DropZone>
      </div>
      <input type="hidden" name={name} value={value} />
      {error && <Text tone="critical" as="span" variant="bodySm">{error}</Text>}
    </BlockStack>
  );
}


// --- Main Route Component ---

export default function DesignDetail() {
  const { design, categories } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isLoading = navigation.state === "submitting";

  const [formState, setFormState] = useState({
    name: design.name,
    imageUrl: design.imageUrl,
    categoryId: design.categoryId || "",
    newCategoryName: "",
    tags: design.tags || "",
    status: design.status,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success) {
      shopify.toast.show("Design updated successfully");
    }
  }, [actionData]);

  const categoryOptions = useMemo(() => {
    const options = categories.map((cat: any) => ({
      label: cat.name,
      value: cat.id,
    }));
    return [{ label: "Create new category...", value: "" }, ...options];
  }, [categories]);

  const handleDelete = () => {
    submit({ _action: "delete" }, { method: "post" });
  };

  return (
    <Page
      backAction={{ content: "Gallery", url: "/app/designs" }}
      title={`Design: ${design.name}`}
      secondaryActions={[
        {
          content: "Delete",
          destructive: true,
          icon: DeleteIcon,
          onAction: () => setShowDeleteModal(true),
        },
      ]}
    >
      <TitleBar title="Edit Design" />
      <Layout>
        <Layout.Section>
          <Form method="POST" data-save-bar>
            <BlockStack gap="500">
              {actionData && 'error' in actionData && actionData.error && (
                <Banner tone="critical">
                  <p>{actionData.error}</p>
                </Banner>
              )}

              <Card>
                <BlockStack gap="500">
                  <Text variant="headingMd" as="h2">
                    Design Settings
                  </Text>
                  <TextField
                    label="Design Name"
                    name="name"
                    value={formState.name}
                    onChange={(name) => setFormState({ ...formState, name })}
                    autoComplete="off"
                    requiredIndicator
                  />

                  <ImageUpload
                    label="Print File"
                    name="imageUrl"
                    value={formState.imageUrl}
                    onChange={(imageUrl) => setFormState({ ...formState, imageUrl })}
                    required
                  />

                  <Layout>
                    <Layout.Section variant="oneHalf">
                      <Select
                        label="Category"
                        options={categoryOptions}
                        value={formState.categoryId}
                        onChange={(categoryId) => setFormState({ ...formState, categoryId })}
                        name="categoryId"
                      />
                    </Layout.Section>
                    <Layout.Section variant="oneHalf">
                      <TextField
                        label="Override Category (Create New)"
                        name="newCategoryName"
                        value={formState.newCategoryName}
                        onChange={(newCategoryName) => setFormState({ ...formState, newCategoryName })}
                        disabled={formState.categoryId !== ""}
                        autoComplete="off"
                        placeholder="e.g., Urban Minimalist"
                      />
                    </Layout.Section>
                  </Layout>

                  <TextField
                    label="Tags"
                    name="tags"
                    value={formState.tags}
                    onChange={(tags) => setFormState({ ...formState, tags })}
                    autoComplete="off"
                    placeholder="minimalist, dark, bold"
                  />

                  <Select
                    label="Status"
                    name="status"
                    options={[
                      { label: "Enabled", value: "ENABLED" },
                      { label: "Disabled", value: "DISABLED" },
                    ]}
                    value={formState.status}
                    onChange={(status) => setFormState({ ...formState, status })}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Print Design?"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: handleDelete,
          loading: navigation.state === "submitting",
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowDeleteModal(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete <b>{design.name}</b>? This design will be removed from your gallery and any active customizer configurations.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
