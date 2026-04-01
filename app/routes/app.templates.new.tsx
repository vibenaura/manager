import { useState, useCallback, useMemo, useEffect } from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useNavigate, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Modal,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Checkbox,
  Text,
  DropZone,
  Thumbnail,
  Banner,
  Box,
  Icon,
  Popover,
  ColorPicker,
  hsbToRgb,
  rgbToHex,
  Tag,
  Divider,
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon, ImageIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const frontImage = formData.get("frontImage") as string;
  const backImage = formData.get("backImage") as string;
  const sideImage = formData.get("sideImage") as string;
  const length = parseFloat(formData.get("length") as string);
  const sleeveLength = parseFloat(formData.get("sleeveLength") as string);
  const widthLength = parseFloat(formData.get("widthLength") as string);
  const sizes = formData.getAll("sizes") as string[];
  const tags = formData.get("tags") as string;

  // Parse complex variants JSON
  const variantsJson = formData.get("colorVariants") as string;
  const colorVariants = JSON.parse(variantsJson || "[]") as Array<{
    colorName: string;
    colorHex: string;
    frontImage?: string;
    backImage?: string;
    sideImage?: string;
  }>;

  if (!name || !frontImage || !backImage) {
    return json({ error: "Missing required fields (Name, Front View, Back View)" }, { status: 400 });
  }

  try {
    await prisma.tShirtTemplate.create({
      data: {
        name,
        frontImage,
        backImage,
        sideImage: sideImage || null,
        length,
        sleeveLength,
        widthLength,
        sizes: sizes.join(", "),
        tags,
        colorVariants: {
          create: colorVariants.map(v => ({
            colorName: v.colorName,
            colorHex: v.colorHex,
            frontImage: v.frontImage || null,
            backImage: v.backImage || null,
            sideImage: v.sideImage || null,
          }))
        }
      },
    });

    return redirect("/app/templates?success=true");
  } catch (error) {
    console.error("Failed to create template", error);
    return json({ error: "Failed to create template" }, { status: 500 });
  }
};

interface ImageUploadProps {
  label: string;
  name: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
  required?: boolean;
}

function ImageUpload({ label, name, value, onChange, error, required }: ImageUploadProps) {
  const fetcher = useFetcher<any>();
  const isUploading = fetcher.state !== "idle";

  const handleDrop = useCallback(
    (_droppedFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        const formData = new FormData();
        formData.append("file", selectedFile);
        console.log(formData, selectedFile)
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
      console.error("Upload error:", fetcher.data.error);
    }
  }, [fetcher.data, onChange, value]);

  const fileUpload = !value && !isUploading && <DropZone.FileUpload actionHint="Accepts .png, .jpg, .svg" />;
  const loading = isUploading && (
    <Box padding="100">
      <InlineStack align="center" blockAlign="center">
        <Text variant="bodyMd" as="p">...</Text>
      </InlineStack>
    </Box>
  );
  const preview = value && (
    <Box padding="100">
      <InlineStack align="start" blockAlign="center" gap="200">
        <Thumbnail size="large" alt="Preview" source={value} />
        <Button variant="tertiary" onClick={() => onChange("")} disabled={isUploading}>
          Remove
        </Button>
      </InlineStack>
    </Box>
  );

  return (
    <BlockStack gap="100">
      <Text variant="bodySm" as="p" fontWeight={required ? "bold" : "regular"}>
        {label}
      </Text>
      <div style={{
        border: `1px dashed ${error ? "#d72c0d" : "#c9cccf"}`,
        borderRadius: "4px",
      }}>
        <DropZone
          onDrop={handleDrop}
          accept="image/*"
          type="image"
          allowMultiple={false}
          disabled={isUploading}
        >
          {preview}
          {loading}
          {fileUpload}
        </DropZone>
      </div>
      <input type="hidden" name={name} value={value} />
    </BlockStack>
  );
}

interface ColorVariant {
  id: string;
  colorName: string;
  colorHex: string;
  frontImage?: string;
  backImage?: string;
  sideImage?: string;
  expanded?: boolean;
}

export default function NewTemplate() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isLoading = navigation.state === "submitting";

  const [formState, setFormState] = useState({
    name: "",
    frontImage: "",
    backImage: "",
    sideImage: "",
    length: "0",
    sleeveLength: "0",
    widthLength: "0",
    tags: "",
  });

  const [variants, setVariants] = useState<ColorVariant[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["S", "M", "L", "XL", "2XL", "3XL"]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hsbColor, setHsbColor] = useState({ hue: 0, brightness: 1, saturation: 1 });

  const [variantForm, setVariantForm] = useState<ColorVariant>({
    id: "",
    colorName: "",
    colorHex: "#00bfa5",
    frontImage: "",
    backImage: "",
    sideImage: "",
  });

  const handleColorChange = useCallback((color: { hue: number; brightness: number; saturation: number }) => {
    setHsbColor(color);
    const rgb = hsbToRgb(color);
    const hex = rgbToHex(rgb);
    setVariantForm(prev => ({ ...prev, colorHex: hex }));
  }, []);

  const addVariant = () => {
    setVariantForm({
      id: Math.random().toString(36).substr(2, 9),
      colorName: "",
      colorHex: "#000000",
      frontImage: "",
      backImage: "",
      sideImage: "",
    });
    setHsbColor({ hue: 0, brightness: 0, saturation: 0 }); // Black default for new
    setIsModalOpen(true);
  };

  const editVariant = (variant: ColorVariant) => {
    setVariantForm(variant);
    // Note: We'd ideally convert hex back to HSB here for a perfect experience, 
    // but starting with a fresh HSB or keeping it simple is fine for now.
    setIsModalOpen(true);
  };

  const saveVariant = () => {
    if (!variantForm.colorName) return;

    const existingIndex = variants.findIndex(v => v.id === variantForm.id);
    if (existingIndex > -1) {
      const newVariants = [...variants];
      newVariants[existingIndex] = variantForm;
      setVariants(newVariants);
    } else {
      setVariants([...variants, variantForm]);
    }
    setIsModalOpen(false);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, updates: Partial<ColorVariant>) => {
    setVariants(variants.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const handleSizeChange = (checked: boolean, size: string) => {
    if (checked) {
      setSelectedSizes([...selectedSizes, size]);
    } else {
      setSelectedSizes(selectedSizes.filter((s) => s !== size));
    }
  };

  return (
    <Page
      backAction={{ content: "Templates", url: "/app/templates", }}
      title="Create T-Shirt Template"
    >
      <TitleBar title="New Template" />
      <Layout>
        <Layout.Section>
          <Form method="POST" data-save-bar>
            <input type="hidden" name="colorVariants" value={JSON.stringify(variants)} />

            <BlockStack gap="500">
              {actionData?.error && (
                <Banner tone="critical">
                  <p>{actionData.error}</p>
                </Banner>
              )}

              <Card>
                <BlockStack gap="500">
                  <Text variant="headingMd" as="h2">Base Template Identity</Text>
                  <TextField
                    label="Template Name"
                    name="name"
                    value={formState.name}
                    onChange={(name) => setFormState({ ...formState, name })}
                    autoComplete="off"
                    requiredIndicator
                  />

                  <Box paddingBlockStart="200">
                    <Text variant="headingSm" as="h3">Base Visuals (Default)</Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      These images will be used if a color variant doesn't have custom images.
                    </Text>
                  </Box>

                  <Layout>
                    <Layout.Section variant="oneThird">
                      <ImageUpload
                        label="Base Front"
                        name="frontImage"
                        value={formState.frontImage}
                        onChange={(url) => setFormState({ ...formState, frontImage: url })}
                        required
                      />
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <ImageUpload
                        label="Base Back"
                        name="backImage"
                        value={formState.backImage}
                        onChange={(url) => setFormState({ ...formState, backImage: url })}
                        required
                      />
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <ImageUpload
                        label="Base Side"
                        name="sideImage"
                        value={formState.sideImage}
                        onChange={(url) => setFormState({ ...formState, sideImage: url })}
                      />
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              {/* Color Variants Section */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text variant="headingMd" as="h2">Color Variants</Text>
                      <Text variant="bodySm" tone="subdued" as="p">
                        Add available colors. You can optionally upload specific textures for each color.
                      </Text>
                    </BlockStack>
                    <Button onClick={addVariant} icon={PlusIcon} variant="secondary">
                      Add Variant
                    </Button>
                  </InlineStack>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                    {variants.map((variant) => (
                      <Box key={variant.id} padding="300" background="bg-surface-secondary" borderRadius="200" borderStyle="solid" borderWidth="025" borderColor="border">
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: variant.colorHex,
                                border: '1px solid rgba(0,0,0,0.1)'
                              }} />
                              <Text variant="bodyMd" fontWeight="bold" as="p">{variant.colorName}</Text>
                            </InlineStack>
                            <InlineStack gap="100">
                              <Button
                                icon={DeleteIcon}
                                tone="critical"
                                variant="tertiary"
                                onClick={() => removeVariant(variant.id)}
                              />
                            </InlineStack>
                          </InlineStack>

                          <Text variant="bodyXs" tone="subdued" as="p">
                            {variant.frontImage || variant.backImage ? "Custom images set" : "Using base images"}
                          </Text>

                          <Button size="slim" onClick={() => editVariant(variant)}>Edit Details</Button>
                        </BlockStack>
                      </Box>
                    ))}
                  </div>

                  {variants.length === 0 && (
                    <Banner tone="info">
                      <p>No color variants added. Add at least one color for this template to be usable.</p>
                    </Banner>
                  )}
                </BlockStack>
              </Card>

              {/* Modal for adding/editing variant */}
              <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={variants.find(v => v.id === variantForm.id) ? "Edit Color Variant" : "Add Color Variant"}
                primaryAction={{
                  content: 'Save Variant',
                  onAction: saveVariant,
                  disabled: !variantForm.colorName
                }}
                secondaryActions={[
                  {
                    content: 'Cancel',
                    onAction: () => setIsModalOpen(false),
                  },
                ]}
              >
                <Modal.Section>
                  <BlockStack gap="400">
                    <TextField
                      label="Color Name"
                      value={variantForm.colorName}
                      onChange={(val) => setVariantForm({ ...variantForm, colorName: val })}
                      autoComplete="off"
                      placeholder="e.g. Midnight Blue"
                    />

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <Text variant="bodySm" fontWeight="bold" as="p">Choose Color</Text>
                        <Box paddingBlockStart="200">
                          <ColorPicker onChange={handleColorChange} color={hsbColor} allowAlpha />
                        </Box>
                      </div>
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Hex Code"
                          value={variantForm.colorHex}
                          onChange={(val) => setVariantForm({ ...variantForm, colorHex: val })}
                          autoComplete="off"
                          prefix="#"
                        />
                        <Box paddingBlockStart="400">
                          <div style={{
                            width: '100%',
                            height: '60px',
                            borderRadius: '8px',
                            backgroundColor: variantForm.colorHex,
                            border: '1px solid #c9cccf',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Text variant="bodySm" as="p" fontWeight="bold" tone={variantForm.colorHex === '#ffffff' ? 'base' : 'critical'}>
                              Preview
                            </Text>
                          </div>
                        </Box>
                      </div>
                    </div>

                    <Divider />

                    <Box>
                      <Text variant="headingSm" as="h3">Texture Overrides (Optional)</Text>
                      <Text variant="bodyXs" tone="subdued" as="p">
                        Upload custom 3D textures for this specific color.
                      </Text>
                    </Box>

                    <Layout>
                      <Layout.Section variant="oneThird">
                        <ImageUpload
                          label="Front"
                          name="v-front"
                          value={variantForm.frontImage || ""}
                          onChange={(url) => setVariantForm({ ...variantForm, frontImage: url })}
                        />
                      </Layout.Section>
                      <Layout.Section variant="oneThird">
                        <ImageUpload
                          label="Back"
                          name="v-back"
                          value={variantForm.backImage || ""}
                          onChange={(url) => setVariantForm({ ...variantForm, backImage: url })}
                        />
                      </Layout.Section>
                      <Layout.Section variant="oneThird">
                        <ImageUpload
                          label="Side"
                          name="v-side"
                          value={variantForm.sideImage || ""}
                          onChange={(url) => setVariantForm({ ...variantForm, sideImage: url })}
                        />
                      </Layout.Section>
                    </Layout>
                  </BlockStack>
                </Modal.Section>
              </Modal>

              {/* Specs Section */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Measurements & Sizing</Text>
                  <InlineStack gap="400">
                    <div style={{ flex: 1 }}>
                      <TextField label="Length (cm)" name="length" type="number" value={formState.length} onChange={(v) => setFormState({ ...formState, length: v })} autoComplete="off" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField label="Sleeve (cm)" name="sleeveLength" type="number" value={formState.sleeveLength} onChange={(v) => setFormState({ ...formState, sleeveLength: v })} autoComplete="off" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField label="Chest (cm)" name="widthLength" type="number" value={formState.widthLength} onChange={(v) => setFormState({ ...formState, widthLength: v })} autoComplete="off" />
                    </div>
                  </InlineStack>

                  <div>
                    <Text variant="bodyMd" as="p" fontWeight="bold">Available Sizes</Text>
                    <InlineStack gap="600">
                      {["S", "M", "L", "XL", "2XL", "3XL"].map((size) => (
                        <Checkbox key={size} label={size} name="sizes" value={size} checked={selectedSizes.includes(size)} onChange={(c) => handleSizeChange(c, size)} />
                      ))}
                    </InlineStack>
                  </div>

                  <TextField
                    label="Search Tags"
                    name="tags"
                    value={formState.tags}
                    onChange={(tags) => setFormState({ ...formState, tags })}
                    autoComplete="off"
                    placeholder="oversized, heavyweight, cotton"
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

