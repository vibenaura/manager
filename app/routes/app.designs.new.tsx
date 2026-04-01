import { useState, useCallback, useMemo, useEffect } from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useLoaderData, useFetcher } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const categories = await prisma.designCategory.findMany({
    orderBy: { name: "asc" },
  });
  return json({ categories });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();

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

    // Handle new category creation
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

    const existingDesign = await prisma.printDesign.findFirst({
      where: { imageUrl }
    });

    if (existingDesign) {
      console.log("Design with this image already exists. Shadowing original.");
      return redirect("/app/designs");
    }

    await prisma.printDesign.create({
      data: {
        name,
        imageUrl,
        categoryId: finalCategoryId || null,
        tags,
        status,
      },
    });

    return redirect("/app/designs");
  } catch (error) {
    console.error("Failed to create design", error);
    return json({ error: "Failed to create design" }, { status: 500 });
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
  const fetcher = useFetcher<any>();
  const isUploading = fetcher.state !== "idle";

  const handleDrop = useCallback(
    (_droppedFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        const formData = new FormData();
        formData.append("file", selectedFile);

        fetcher.submit(formData, {
          method: "POST",
          action: "/api/upload",
          encType: "multipart/form-data",
        });
      }
    },
    [fetcher],
  );

  useEffect(() => {
    if (fetcher.data && fetcher.data.url && fetcher.data.url !== value) {
      onChange(fetcher.data.url);
    } else if (fetcher.data && fetcher.data.error) {
       console.error("Upload failed", fetcher.data.error);
       shopify.toast.show(fetcher.data.error || "Failed to upload image", { isError: true });
    }
  }, [fetcher.data, onChange, value]);

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
            {file?.name || "Ready to upload"}
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

export default function NewDesign() {
  const { categories } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [formState, setFormState] = useState({
    name: "",
    imageUrl: "",
    categoryId: "",
    newCategoryName: "",
    tags: "",
    status: "ENABLED",
  });

  const categoryOptions = useMemo(() => {
    const options = categories.map((cat: any) => ({
      label: cat.name,
      value: cat.id,
    }));
    return [{ label: "Create new category...", value: "" }, ...options];
  }, [categories]);

  return (
    <Page
      backAction={{ content: "Gallery", url: "/app/designs" }}
      title="Add New Print Design"
    >
      <TitleBar title="New Design" />
      <Layout>
        <Layout.Section>
          <Form method="POST">
            <BlockStack gap="500">
              {actionData?.error && (
                <Banner tone="critical">
                  <p>{actionData.error}</p>
                </Banner>
              )}

              <Card>
                <BlockStack gap="500">
                  <Text variant="headingMd" as="h2">
                    Design Basics
                  </Text>
                  <TextField
                    label="Design Name"
                    name="name"
                    value={formState.name}
                    onChange={(name) => setFormState({ ...formState, name })}
                    autoComplete="off"
                    requiredIndicator
                    placeholder="e.g., Abstract Aura v1"
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
                        helpText="Choose an existing category or create a new one below."
                      />
                    </Layout.Section>
                    <Layout.Section variant="oneHalf">
                      <TextField
                        label="New Category Name"
                        name="newCategoryName"
                        value={formState.newCategoryName}
                        onChange={(newCategoryName) => setFormState({ ...formState, newCategoryName })}
                        disabled={formState.categoryId !== ""}
                        autoComplete="off"
                        placeholder="e.g., Summer Patterns"
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

              <InlineStack align="end">
                <Button onClick={() => window.history.back()}>
                  Cancel
                </Button>
                <Button submit variant="primary" loading={isLoading}>
                  Add Design
                </Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
