import { authenticate } from "../shopify.server";

export async function uploadFileToShopify(request: Request, file: File) {
  const { admin } = await authenticate.admin(request);

  // 1. Create staged upload target
  const stagedResponse = await admin.graphql(
    `#graphql
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: [
          {
            filename: file.name,
            mimeType: file.type,
            resource: "IMAGE",
            httpMethod: "POST",
          },
        ],
      },
    }
  );

  const stagedData = await stagedResponse.json();
  if (stagedData.data.stagedUploadsCreate.userErrors?.length > 0) {
    console.error("Staged Upload User Errors:", stagedData.data.stagedUploadsCreate.userErrors);
    throw new Error(`Staged upload errors: ${JSON.stringify(stagedData.data.stagedUploadsCreate.userErrors)}`);
  }
  
  const target = stagedData.data.stagedUploadsCreate.stagedTargets[0];

  if (!target) {
    console.log("Staged response data:", JSON.stringify(stagedData, null, 2));
    throw new Error("Failed to create staged upload target");
  }

  // 2. Upload the file to the staged target
  const formData = new FormData();
  target.parameters.forEach(({ name, value }: { name: string; value: string }) => {
    formData.append(name, value);
  });
  formData.append("file", file);

  const uploadResponse = await fetch(target.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file to staged target");
  }

  // 3. Create the file in Shopify
  const fileCreateResponse = await admin.graphql(
    `#graphql
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          ... on MediaImage {
            image {
              url
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        files: [
          {
            alt: file.name,
            contentType: "IMAGE",
            originalSource: target.resourceUrl,
          },
        ],
      },
    }
  );

  const fileCreateData = await fileCreateResponse.json();
  if (fileCreateData.data.fileCreate.userErrors?.length > 0) {
    console.error("File Create User Errors:", fileCreateData.data.fileCreate.userErrors);
    throw new Error(`File create errors: ${JSON.stringify(fileCreateData.data.fileCreate.userErrors)}`);
  }

  const fileRecord = fileCreateData.data.fileCreate.files[0];

  if (!fileRecord) {
    console.log("File create data:", JSON.stringify(fileCreateData, null, 2));
    throw new Error("Failed to create file record in Shopify");
  }

  // 4. Poll for the file to be ready (it's async)
  let status = fileRecord.fileStatus;
  let finalUrl = fileRecord.image?.url || fileRecord.url;
  let attempts = 0;

  console.log(`Initial file status for ${fileRecord.id}: ${status}`);

  // Continue polling if the file is still being processed or just uploaded
  while ((status === "PROCESSING" || status === "UPLOADED") && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const checkResponse = await admin.graphql(
      `#graphql
      query checkFileStatus($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            fileStatus
            image {
              url
            }
          }
          ... on GenericFile {
            fileStatus
            url
          }
        }
      }`,
      { variables: { id: fileRecord.id } }
    );
    
    const checkData = await checkResponse.json();
    const node = checkData.data.node;
    
    if (node) {
      status = node.fileStatus;
      finalUrl = node.image?.url || node.url;
      console.log(`Polling status [${attempts + 1}/30]: ${status} - URL: ${finalUrl ? 'Found' : 'Missing'}`);
    } else {
      console.error("Node not found during polling:", fileRecord.id);
      break;
    }
    
    if (status === "READY" && finalUrl) break;
    attempts++;
  }

  if (status === "FAILED") {
    throw new Error("Shopify file processing failed");
  }

  if (!finalUrl && status !== "READY") {
    console.warn(`Polling timed out or ended without URL. Final status: ${status}`);
  }

  return finalUrl;
}
