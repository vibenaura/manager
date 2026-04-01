import { useState, useCallback, useMemo, useEffect } from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useLoaderData, useSubmit, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
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
  Divider,
  Modal,
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { id } = params;

  if (!id) return redirect("/app/templates");

  const template = await prisma.tShirtTemplate.findUnique({
    where: { id },
    include: { colorVariants: true }
  });

  if (!template) throw new Response("Not Found", { status: 404 });

  return json({ template });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "delete") {
    await prisma.tShirtTemplate.delete({ where: { id } });
    return redirect("/app/templates");
  }

  const name = formData.get("name") as string;
  const frontImage = formData.get("frontImage") as string;
  const backImage = formData.get("backImage") as string;
  const sideImage = formData.get("sideImage") as string;
  const length = parseFloat(formData.get("length") as string);
  const sleeveLength = parseFloat(formData.get("sleeveLength") as string);
  const widthLength = parseFloat(formData.get("widthLength") as string);
  const sizes = formData.getAll("sizes") as string[];
  const tags = formData.get("tags") as string;
  
  const variantsJson = formData.get("colorVariants") as string;
  const colorVariants = JSON.parse(variantsJson || "[]") as any[];

  if (!name || !frontImage || !backImage) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      // Clean old variants
      prisma.tShirtTemplateColorVariant.deleteMany({ where: { templateId: id } }),
      // Update template and create new variants
      prisma.tShirtTemplate.update({
        where: { id },
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
      })
    ]);

    return json({ success: true });
  } catch (error) {
    console.error("Update failed", error);
    return json({ error: "Failed to update template" }, { status: 500 });
  }
};

// --- Sub-components ---

function ImageUpload({ label, value, onChange, required }: { label: string, value: string, onChange: (url: string) => void, required?: boolean }) {
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = useCallback(async (_d: any, acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setIsUploading(true);
      const fd = new FormData();
      fd.append("file", acceptedFiles[0]);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) onChange(data.url);
      } catch (err) { console.error(err); }
      finally { setIsUploading(false); }
    }
  }, [onChange]);

  return (
    <BlockStack gap="100">
      <Text variant="bodySm" as="p" fontWeight={required ? "bold" : "regular"}>{label}</Text>
      <div style={{ border: '1px dashed #c9cccf', borderRadius: '4px' }}>
        <DropZone onDrop={handleDrop} accept="image/*" type="image" allowMultiple={false} disabled={isUploading}>
          {value ? (
            <Box padding="100">
              <InlineStack align="center" blockAlign="center" gap="200">
                <Thumbnail size="small" alt="Preview" source={value} />
                <Button variant="tertiary" onClick={() => onChange("")}>Remove</Button>
              </InlineStack>
            </Box>
          ) : (
            isUploading ? <Box padding="100"><Text variant="bodyMd" as="p">...</Text></Box> : <DropZone.FileUpload />
          )}
        </DropZone>
      </div>
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

export default function TemplateDetail() {
  const { template } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate();
  const isLoading = navigation.state === "submitting";

  const [formState, setFormState] = useState({
    name: template.name,
    frontImage: template.frontImage,
    backImage: template.backImage,
    sideImage: template.sideImage || "",
    length: template.length.toString(),
    sleeveLength: template.sleeveLength.toString(),
    widthLength: template.widthLength.toString(),
    tags: template.tags || "",
  });

  const [variants, setVariants] = useState<ColorVariant[]>(
    template.colorVariants.map((v: any) => ({ ...v, expanded: false }))
  );

  const [selectedSizes, setSelectedSizes] = useState<string[]>(template.sizes.split(",").map((s: string) => s.trim()));
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (actionData && 'success' in actionData) {
      shopify.toast.show("Template updated");
    }
  }, [actionData]);

  const addVariant = () => {
    setVariants([...variants, { id: Math.random().toString(36).substr(2,9), colorName: "New Color", colorHex: "#000000", expanded: true }]);
  };

  return (
    <Page
      backAction={{ content: "Templates", url: "/app/templates" }}
      title={`Edit: ${template.name}`}
      secondaryActions={[{ content: "Delete", destructive: true, icon: DeleteIcon, onAction: () => setShowDeleteModal(true) }]}
    >
      <TitleBar title="Edit Template" />
      <Form method="POST" data-save-bar>
        <input type="hidden" name="colorVariants" value={JSON.stringify(variants)} />
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
               {actionData && 'error' in actionData && <Banner tone="critical">{actionData.error}</Banner>}
              
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Base Template Identity</Text>
                  <TextField label="Template Name" name="name" value={formState.name} onChange={(v) => setFormState({...formState, name:v})} autoComplete="off" />
                  
                  <Box paddingBlockStart="200">
                    <Text variant="headingSm" as="h3">Base Visuals</Text>
                  </Box>
                  <Layout>
                    <Layout.Section variant="oneThird"><ImageUpload label="Base Front" value={formState.frontImage} onChange={(v) => setFormState({...formState, frontImage:v})} required /></Layout.Section>
                    <Layout.Section variant="oneThird"><ImageUpload label="Base Back" value={formState.backImage} onChange={(v) => setFormState({...formState, backImage:v})} required /></Layout.Section>
                    <Layout.Section variant="oneThird"><ImageUpload label="Base Side" value={formState.sideImage} onChange={(v) => setFormState({...formState, sideImage:v})} /></Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              {/* Variants */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h2">Color Variants</Text>
                    <Button onClick={addVariant} icon={PlusIcon}>Add Color</Button>
                  </InlineStack>

                  {variants.map((variant, idx) => (
                    <Box key={variant.id} padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="400">
                        <InlineStack align="space-between">
                          <InlineStack gap="400">
                            <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: variant.colorHex, border: '1px solid rgba(0,0,0,0.1)' }} />
                            <Text variant="bodyMd" fontWeight="bold" as="p">#{idx+1}: {variant.colorName}</Text>
                          </InlineStack>
                          <InlineStack gap="200">
                            <Button icon={variant.expanded ? ChevronUpIcon : ChevronDownIcon} variant="tertiary" onClick={() => setVariants(variants.map(v => v.id === variant.id ? {...v, expanded: !v.expanded} : v))} />
                            <Button icon={DeleteIcon} tone="critical" variant="tertiary" onClick={() => setVariants(variants.filter(v => v.id !== variant.id))} />
                          </InlineStack>
                        </InlineStack>

                        {variant.expanded && (
                          <BlockStack gap="400">
                            <Divider />
                            <InlineStack gap="400">
                              <div style={{flex:2}}><TextField label="Color Name" value={variant.colorName} onChange={(val) => setVariants(variants.map(vrt => vrt.id === variant.id ? {...vrt, colorName:val} : vrt))} autoComplete="off" /></div>
                              <div style={{flex:1}}><TextField label="Hex Code" value={variant.colorHex} onChange={(val) => setVariants(variants.map(vrt => vrt.id === variant.id ? {...vrt, colorHex:val} : vrt))} prefix="#" autoComplete="off" /></div>
                            </InlineStack>
                            <Box paddingBlockStart="200">
                               <Text variant="bodySm" fontWeight="bold" as="p">Custom Overrides (Optional)</Text>
                            </Box>
                            <Layout>
                              <Layout.Section variant="oneThird"><ImageUpload label="Front" value={variant.frontImage||""} onChange={(val) => setVariants(variants.map(vrt => vrt.id === variant.id ? {...vrt, frontImage:val} : vrt))} /></Layout.Section>
                              <Layout.Section variant="oneThird"><ImageUpload label="Back" value={variant.backImage||""} onChange={(val) => setVariants(variants.map(vrt => vrt.id === variant.id ? {...vrt, backImage:val} : vrt))} /></Layout.Section>
                              <Layout.Section variant="oneThird"><ImageUpload label="Side" value={variant.sideImage||""} onChange={(val) => setVariants(variants.map(vrt => vrt.id === variant.id ? {...vrt, sideImage:val} : vrt))} /></Layout.Section>
                            </Layout>
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Measurements & Sizing</Text>
                  <InlineStack gap="400">
                     <div style={{flex:1}}><TextField label="Length (cm)" type="number" value={formState.length} onChange={(v) => setFormState({...formState, length:v})} autoComplete="off" /></div>
                     <div style={{flex:1}}><TextField label="Sleeve (cm)" type="number" value={formState.sleeveLength} onChange={(v) => setFormState({...formState, sleeveLength:v})} autoComplete="off" /></div>
                     <div style={{flex:1}}><TextField label="Chest (cm)" type="number" value={formState.widthLength} onChange={(v) => setFormState({...formState, widthLength:v})} autoComplete="off" /></div>
                  </InlineStack>
                  <InlineStack gap="600">
                    {["S", "M", "L", "XL", "2XL", "3XL"].map(sz => (
                      <Checkbox key={sz} label={sz} name="sizes" value={sz} checked={selectedSizes.includes(sz)} onChange={(c) => c ? setSelectedSizes([...selectedSizes, sz]) : setSelectedSizes(selectedSizes.filter(s => s!==sz))} />
                    ))}
                  </InlineStack>
                  <TextField label="Tags" name="tags" value={formState.tags} onChange={(v) => setFormState({...formState, tags:v})} autoComplete="off" />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Form>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Template?" primaryAction={{ content: "Delete", destructive: true, onAction: () => submit({_action:"delete"}, {method:"post"}), loading: isLoading }} secondaryActions={[{ content: "Cancel", onAction: () => setShowDeleteModal(false) }]}>
        <Modal.Section><Text as="p">Delete <b>{template.name}</b>? This cannot be undone.</Text></Modal.Section>
      </Modal>
    </Page>
  );
}

