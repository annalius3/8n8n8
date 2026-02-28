import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getServerEnv } from "@/lib/env";

type R2UploadInput = {
  imageUrl: string;
  objectPath: string;
  contentType?: string;
};

function getRequired(name: string) {
  const value = getServerEnv()[name as keyof ReturnType<typeof getServerEnv>];
  if (!value) {
    throw new Error(`${name} is required for R2 upload`);
  }
  return value;
}

export async function uploadToR2({ imageUrl, objectPath, contentType = "image/jpeg" }: R2UploadInput): Promise<string> {
  const endpoint = getRequired("R2_ENDPOINT");
  const accessKeyId = getRequired("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequired("R2_SECRET_ACCESS_KEY");
  const bucket = getRequired("R2_BUCKET");
  const publicBaseUrl = getServerEnv().R2_PUBLIC_BASE_URL;

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image for upload: ${imageResponse.status}`);
  }

  const body = new Uint8Array(await imageResponse.arrayBuffer());

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectPath,
      Body: body,
      ContentType: contentType
    })
  );

  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${objectPath}`;
  }

  return `${endpoint.replace(/\/$/, "")}/${bucket}/${objectPath}`;
}
