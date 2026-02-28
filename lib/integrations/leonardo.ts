import { getServerEnv } from "@/lib/env";
import { getIntegrationModes } from "@/lib/integrations/runtime";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export type LeonardoImageOptions = {
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  numImages?: number;
  timeoutSeconds?: number;
  userId?: string;
};

export type LeonardoImageResult = {
  imageUrl: string;
  generationId: string;
  mode: "real";
};

type CreateGenerationResponse = {
  sdGenerationJob?: {
    generationId?: string;
  };
};

type GetGenerationResponse = {
  generations_by_pk?: {
    generated_images?: Array<{
      url?: string;
    }>;
    status?: string;
  };
};

async function resolveLeonardoApiKey(userId?: string) {
  if (userId) {
    const secret = await prisma.connection.findFirst({
      where: {
        userId,
        provider: "leonardo_key"
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    if (secret) {
      const parsed = JSON.parse(decryptToken(secret.encryptedJson)) as { apiKey?: string };
      if (parsed.apiKey) {
        return parsed.apiKey;
      }
    }
  }

  const mode = getIntegrationModes().leonardo;
  return mode === "real" ? getServerEnv().LEONARDO_API_KEY : undefined;
}

export async function generateLeonardoImage(prompt: string, options: LeonardoImageOptions = {}): Promise<LeonardoImageResult> {
  const apiKey = await resolveLeonardoApiKey(options.userId);
  if (!apiKey) {
    throw new Error("Leonardo API key is not configured");
  }

  const createResponse = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: options.negativePrompt,
      width: options.width ?? 1024,
      height: options.height ?? 1024,
      num_images: options.numImages ?? 1,
      guidance_scale: options.guidanceScale ?? 7,
      num_inference_steps: options.steps ?? 30,
      modelId: "b24e16ff-06e3-43eb-8d33-4416c2d75876"
    })
  });

  if (!createResponse.ok) {
    throw new Error(`Leonardo create failed: ${createResponse.status}`);
  }

  const createData = (await createResponse.json()) as CreateGenerationResponse;
  const generationId = createData.sdGenerationJob?.generationId;
  if (!generationId) {
    throw new Error("Leonardo generationId missing");
  }

  const timeoutMs = (options.timeoutSeconds ?? 90) * 1000;
  const timeoutAt = Date.now() + timeoutMs;

  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const pollResponse = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!pollResponse.ok) {
      continue;
    }

    const pollData = (await pollResponse.json()) as GetGenerationResponse;
    const imageUrl = pollData.generations_by_pk?.generated_images?.[0]?.url;
    const status = pollData.generations_by_pk?.status?.toUpperCase();

    if (imageUrl) {
      return { imageUrl, generationId, mode: "real" };
    }

    if (status === "FAILED") {
      throw new Error("Leonardo generation failed");
    }
  }

  throw new Error("Leonardo generation timed out");
}

export async function deleteLeonardoGeneration(generationId: string, userId?: string) {
  const apiKey = await resolveLeonardoApiKey(userId);
  if (!apiKey) {
    throw new Error("Leonardo API key is not configured");
  }

  const response = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Leonardo delete failed: ${response.status} ${body.slice(0, 300)}`);
  }
}
