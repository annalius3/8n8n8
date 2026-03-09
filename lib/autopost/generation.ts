import { getServerEnv } from "@/lib/env";
import { buildLeonardoPrompt } from "@/lib/images/prompt-builder";

export type GeneratedPlatformContent = {
  twitter: Array<{ text: string; hashtags: string[] }>;
  linkedin: Array<{ text: string }>;
  reddit: { title: string; body: string; suggestedSubreddits: string[] };
  telegram: { text: string };
  pinterest: { pinTitle: string; pinDescription: string; imagePrompt: string };
  medium?: { title: string; body: string };
  facebook?: { text: string };
  general: {
    shortSummary: string;
    metaExcerpt: string;
    imagePromptHorizontal: string;
    imagePromptVertical: string;
    tags: string[];
  };
};

function strip(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function parseStrictJson<T>(content: string): T {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? content) as T;
}

async function callOpenAI<T>(input: { system: string; prompt: string; maxTokens?: number; temperature?: number }) {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: input.temperature ?? 0.6,
      max_tokens: input.maxTokens ?? 2000,
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

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return parseStrictJson<T>(content);
}

export async function generatePlatformContent(input: {
  title: string;
  canonicalUrl: string;
  category?: string | null;
  excerpt?: string | null;
  content: string;
}) {
  const payload = await callOpenAI<GeneratedPlatformContent>({
    system: [
      "You are a senior B2B content strategist.",
      "Create useful educational social posts for traffic growth.",
      "Avoid spam tone, avoid clickbait, keep claims accurate.",
      "Use original article intent as source of truth.",
      "Return strict JSON only."
    ].join(" "),
    prompt: [
      `Article title: ${input.title}`,
      `Canonical URL: ${input.canonicalUrl}`,
      input.category ? `Category: ${input.category}` : null,
      `Excerpt: ${input.excerpt ?? ""}`,
      `Content: ${input.content.slice(0, 12_000)}`,
      "Output rules:",
      "- twitter: 2 variants, each with text and hashtags (1..3), must include canonical URL",
      "- linkedin: 2 variants, each 500..900 chars, first line as hook, include CTA and canonical URL",
      "- reddit: title + body, discussion style, non-spam, place URL near the end",
      "- telegram: 300..700 chars, concise and informative with URL",
      "- pinterest: pinTitle <= 90, pinDescription <= 500, vertical imagePrompt (professional editorial SaaS/B2B)",
      "- general: shortSummary, metaExcerpt, horizontal + vertical image prompts, tags[]",
      'Respond with strict JSON object keys: twitter, linkedin, reddit, telegram, pinterest, general. Optional keys: medium, facebook.'
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 2600,
    temperature: 0.65
  });

  const canonicalUrl = input.canonicalUrl;
  const safeSummary = strip(input.excerpt || input.content).slice(0, 260);
  const fallbackTwitter = `New article: ${strip(input.title)} ${canonicalUrl}`.slice(0, 280);
  const fallbackLinkedIn = `${strip(input.title)}\n\n${safeSummary}\n\nRead full article: ${canonicalUrl}`.slice(0, 900);
  const fallbackRedditTitle = strip(input.title).slice(0, 280);
  const fallbackRedditBody = `${safeSummary}\n\nSource: ${canonicalUrl}`.slice(0, 3500);
  const fallbackTelegram = `${strip(input.title)}\n\n${safeSummary}\n\n${canonicalUrl}`.slice(0, 700);
  const fallbackPinTitle = strip(input.title).slice(0, 90);
  const fallbackPinDescription = `${safeSummary}\n\n${canonicalUrl}`.slice(0, 500);
  const fallbackPinPrompt = buildLeonardoPrompt({
    topic: input.title,
    title: input.title,
    description: input.excerpt ?? input.content.slice(0, 500)
  }).prompt;

  const twitter = safeArray(payload.twitter)
    .map((item) => ({
      text: strip((item as { text?: string }).text),
      hashtags: safeArray((item as { hashtags?: string[] }).hashtags).map((tag) => strip(tag)).filter(Boolean).slice(0, 3)
    }))
    .filter((item) => item.text)
    .slice(0, 3);

  const linkedin = safeArray(payload.linkedin)
    .map((item) => ({ text: strip((item as { text?: string }).text).slice(0, 900) }))
    .filter((item) => item.text.length >= 250)
    .slice(0, 3);

  return {
    twitter:
      twitter.length > 0
        ? twitter.map((item) => ({
            ...item,
            text: item.text.includes(canonicalUrl) ? item.text : `${item.text} ${canonicalUrl}`.slice(0, 280)
          }))
        : [{ text: fallbackTwitter, hashtags: [] }],
    linkedin:
      linkedin.length > 0
        ? linkedin.map((item) => ({
            text: item.text.includes(canonicalUrl) ? item.text : `${item.text}\n\nRead full article: ${canonicalUrl}`.slice(0, 900)
          }))
        : [{ text: fallbackLinkedIn }],
    reddit: {
      title: strip(payload.reddit?.title).slice(0, 300) || fallbackRedditTitle,
      body:
        (strip(payload.reddit?.body).slice(0, 4000) || fallbackRedditBody).includes(canonicalUrl)
          ? strip(payload.reddit?.body).slice(0, 4000) || fallbackRedditBody
          : `${strip(payload.reddit?.body).slice(0, 3800) || fallbackRedditBody}\n\nSource: ${canonicalUrl}`.slice(0, 4000),
      suggestedSubreddits: safeArray(payload.reddit?.suggestedSubreddits).map((name) => strip(name)).filter(Boolean).slice(0, 10)
    },
    telegram: {
      text:
        (strip(payload.telegram?.text).slice(0, 700) || fallbackTelegram).includes(canonicalUrl)
          ? strip(payload.telegram?.text).slice(0, 700) || fallbackTelegram
          : `${strip(payload.telegram?.text).slice(0, 620) || fallbackTelegram}\n\n${canonicalUrl}`.slice(0, 700)
    },
    pinterest: {
      pinTitle: strip(payload.pinterest?.pinTitle).slice(0, 90) || fallbackPinTitle,
      pinDescription: strip(payload.pinterest?.pinDescription).slice(0, 500) || fallbackPinDescription,
      imagePrompt: strip(payload.pinterest?.imagePrompt).slice(0, 1000) || fallbackPinPrompt
    },
    medium: payload.medium
      ? {
          title: strip(payload.medium.title).slice(0, 160),
          body: strip(payload.medium.body).slice(0, 10_000)
        }
      : undefined,
    facebook: payload.facebook
      ? {
          text: strip(payload.facebook.text).slice(0, 2000)
        }
      : undefined,
    general: {
      shortSummary: strip(payload.general?.shortSummary).slice(0, 300),
      metaExcerpt: strip(payload.general?.metaExcerpt).slice(0, 350),
      imagePromptHorizontal:
        strip(payload.general?.imagePromptHorizontal).slice(0, 1000) ||
        buildLeonardoPrompt({
          topic: input.title,
          title: input.title,
          description: input.excerpt ?? input.content.slice(0, 500),
          promptTemplate: [
            "Create a clean horizontal editorial social preview image about {topic}.",
            "Main subject: {visual_subject}.",
            "Scene: {visual_scene}.",
            "Style: {visual_style}.",
            "Composition: wide 16:9 social preview, simple background, clear focal point.",
            "Use relevant business details from: {description}.",
            "No text, no letters, no watermark, no logo."
          ].join(" ")
        }).prompt,
      imagePromptVertical: strip(payload.general?.imagePromptVertical).slice(0, 1000) || fallbackPinPrompt,
      tags: safeArray(payload.general?.tags).map((tag) => strip(tag)).filter(Boolean).slice(0, 20)
    }
  };
}
