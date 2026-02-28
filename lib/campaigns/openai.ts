import { getServerEnv } from "@/lib/env";

export function toPublicOpenAIErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("insufficient_quota") || (normalized.includes("429") && normalized.includes("quota"))) {
    return "Не удалось выполнить запрос к OpenAI: закончилась квота или не настроен billing. Проверьте тариф и платежные настройки OpenAI.";
  }

  if (normalized.includes("429")) {
    return "OpenAI временно отклонил запрос из-за лимитов. Повторите попытку позже.";
  }

  if (normalized.includes("openai_api_key is not configured")) {
    return "Не настроен OPENAI_API_KEY на сервере.";
  }

  if (normalized.includes("openai request failed")) {
    return "Не удалось выполнить запрос к OpenAI. Проверьте ключ API, billing и доступность модели.";
  }

  return "Не удалось выполнить запрос к OpenAI.";
}

function parseStrictJson<T>(content: string): T {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? content) as T;
}

async function callOpenAI<T>(input: {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: input.temperature ?? 0.4,
      max_tokens: input.maxTokens ?? 1200,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  return parseStrictJson<T>(content);
}

export async function generateTopicSuggestions(input: {
  seedTopic: string;
  language: "EN" | "RU" | "UA";
  niche?: string | null;
  audience?: string | null;
  tone?: string | null;
}) {
  const topics = await callOpenAI<string[]>({
    system:
      "You generate topic ideas for social media campaigns. Return strict JSON only: an array of exactly 50 strings. No markdown, no commentary.",
    prompt: [
      `Seed topic: ${input.seedTopic}`,
      `Language: ${input.language}`,
      input.niche ? `Niche/angle: ${input.niche}` : null,
      input.audience ? `Audience: ${input.audience}` : null,
      input.tone ? `Tone: ${input.tone}` : null,
      "Generate exactly 50 distinct topic ideas.",
      "Return strict JSON only: [\"topic 1\", \"topic 2\", ...]."
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 1400,
    temperature: 0.8
  });

  const cleaned = topics.map((item) => String(item).trim()).filter(Boolean);
  if (cleaned.length !== 50) {
    throw new Error(`OpenAI returned ${cleaned.length} topics instead of 50`);
  }

  return cleaned;
}

export async function generateQueueItemContent(input: {
  language: "EN" | "RU" | "UA";
  topic: string;
  niche?: string | null;
  audience?: string | null;
  tone?: string | null;
}) {
  const payload = await callOpenAI<{ title: string; description: string; hashtags?: string[] }>({
    system:
      "You write Pinterest-ready content. Return strict JSON only: {\"title\":\"...\",\"description\":\"...\",\"hashtags\":[\"#tag\"]}. No markdown.",
    prompt: [
      `Language: ${input.language}`,
      `Topic: ${input.topic}`,
      input.niche ? `Niche/angle: ${input.niche}` : null,
      input.audience ? `Audience: ${input.audience}` : null,
      input.tone ? `Tone: ${input.tone}` : null,
      "Create a pin title up to 90 characters and a description up to 450 characters.",
      "Return strict JSON only."
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 500,
    temperature: 0.7
  });

  const title = String(payload.title ?? "").trim().slice(0, 90);
  const description = String(payload.description ?? "").trim().slice(0, 450);
  const hashtags = Array.isArray(payload.hashtags)
    ? payload.hashtags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  if (!title || !description) {
    throw new Error("OpenAI did not return a valid title and description");
  }

  return {
    title,
    description,
    hashtags
  };
}
