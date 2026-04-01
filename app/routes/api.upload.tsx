import { json, type ActionFunctionArgs, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import { createHash } from "node:crypto";
import { authenticate } from "../shopify.server";
import { uploadFileToShopify } from "../utils/shopify-upload.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    console.log("Request Headers:", Object.fromEntries(request.headers.entries()));
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: 10 * 1024 * 1024, // 10MB
    });
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
    console.log("Parsed FormData keys:", Array.from(formData.keys()));
    const file = formData.get("file") as File;

    if (!file) {
      console.log("No file found in formData");
      return json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log("File found:", file.name, file.size, file.type);

    // DEDUPLICATION LOGIC
    const buffer = Buffer.from(await file.arrayBuffer());
    const md5 = createHash("md5").update(buffer).digest("hex");
    console.log("File MD5:", md5);

    const existingFile = await prisma.uploadedFile.findUnique({
      where: { md5 }
    });

    if (existingFile) {
      console.log("Duplicate found! Returning existing URL:", existingFile.url);
      return json({ url: existingFile.url });
    }

    const shopifyUrl = await uploadFileToShopify(request, file);
    console.log("New upload - shopifyUrl:", shopifyUrl);

    if (shopifyUrl) {
      await prisma.uploadedFile.create({
        data: { md5, url: shopifyUrl }
      });
    }

    return json({ url: shopifyUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return json({ error: error.message || "Failed to upload file" }, { status: 500 });
  }
};
