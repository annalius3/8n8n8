import { getServerEnv } from "@/lib/env";
import { getIntegrationModes } from "@/lib/integrations/runtime";

export type LeonardoImageOptions = {
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  numImages?: number;
  timeoutSeconds?: number;
};

export type LeonardoImageResult = {
  imageUrl: string;
  mode: "real" | "demo";
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

export async function generateLeonardoImage(prompt: string, options: LeonardoImageOptions = {}): Promise<LeonardoImageResult> {
  const mode = getIntegrationModes().leonardo;
  const apiKey = mode === "real" ? getServerEnv().LEONARDO_API_KEY : undefined;
  if (!apiKey) {
    const width = options.width ?? 1024;
    const height = options.height ?? 1024;
    const text = encodeURIComponent("Demo Leonardo Image");
    return {
      imageUrl: `https://placehold.co/${width}x${height}/f4f7fb/1f2937?text=${text}`,
      mode: "demo"
    };
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
      return { imageUrl, mode: "real" };
    }

    if (status === "FAILED") {
      throw new Error("Leonardo generation failed");
    }
  }

  throw new Error("Leonardo generation timed out");
}
