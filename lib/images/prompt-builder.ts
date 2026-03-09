import { applyTemplate } from "@/lib/worker/template";

type VisualScene = {
  subject: string;
  scene: string;
};

const DEFAULT_NEGATIVE_PROMPT =
  "text, letters, words, watermark, logo, blurry, cluttered composition, distorted hands, distorted face, extra fingers, duplicate objects, low quality, noisy background";

function normalize(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, Math.max(0, length - 3)).trim()}...` : value;
}

function pickVisualScene(topic: string, description: string) {
  const haystack = `${topic} ${description}`.toLowerCase();

  if (/(crm|dashboard|analytics|pipeline|lead|report|conversion|sales software|saas)/.test(haystack)) {
    return {
      subject: "a marketer working at a laptop with a clean analytics dashboard visible on screen",
      scene: "modern office workspace, focused professional, clean desk, soft daylight"
    } satisfies VisualScene;
  }

  if (/(team|meeting|strategy|outbound|workflow|process|growth plan|sales team)/.test(haystack)) {
    return {
      subject: "a small business team reviewing strategy around a screen",
      scene: "modern meeting room, collaborative planning moment, clean composition"
    } satisfies VisualScene;
  }

  if (/(guide|checklist|comparison|tools|software|stack|template|tips)/.test(haystack)) {
    return {
      subject: "a curated desktop workspace with laptop, notebook, and minimal business tools",
      scene: "editorial flat lay, neat layout, premium B2B blog aesthetic"
    } satisfies VisualScene;
  }

  if (/(ai|automation|integration|machine learning|agent|api)/.test(haystack)) {
    return {
      subject: "a clean futuristic SaaS workspace with subtle automation interface elements",
      scene: "minimal editorial tech scene, realistic lighting, uncluttered background"
    } satisfies VisualScene;
  }

  return {
    subject: "a professional working with a laptop in a modern office",
    scene: "clean editorial business scene, simple background, strong focal point"
  } satisfies VisualScene;
}

export function getDefaultNegativePrompt() {
  return DEFAULT_NEGATIVE_PROMPT;
}

export function getDefaultLeonardoPromptTemplate() {
  return [
    "Create a clean editorial blog cover image about {topic}.",
    "Main subject: {visual_subject}.",
    "Scene: {visual_scene}.",
    "Style: {visual_style}.",
    "Composition: {visual_composition}.",
    "Format: {visual_format}.",
    "Use relevant business details from: {description}.",
    "If useful, incorporate this product hint naturally: {image_prompt}.",
    "No text, no letters, no watermark, no logo, no collage, no extra objects."
  ].join(" ");
}

export function buildLeonardoPrompt(input: {
  topic?: string;
  title?: string;
  description?: string;
  imagePrompt?: string;
  promptTemplate?: string;
}) {
  const topic = normalize(input.topic || input.title || "B2B marketing topic");
  const description = truncate(normalize(input.description), 220);
  const imagePrompt = truncate(normalize(input.imagePrompt), 220);
  const visual = pickVisualScene(topic, `${description} ${imagePrompt}`);

  const vars = {
    topic,
    title: normalize(input.title || input.topic || ""),
    description,
    image_prompt: imagePrompt,
    visual_subject: visual.subject,
    visual_scene: visual.scene,
    visual_style: "modern B2B SaaS, professional, minimal, realistic photo, soft studio lighting",
    visual_composition: "clear focal point, simple background, strong visual hierarchy, editorial blog cover",
    visual_format: "Pinterest vertical 1000x1500",
    negative_prompt: DEFAULT_NEGATIVE_PROMPT
  };

  const template = input.promptTemplate ?? getDefaultLeonardoPromptTemplate();

  return {
    prompt: applyTemplate(template, vars),
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    vars
  };
}
