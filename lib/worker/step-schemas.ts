import { z } from "zod";

const conditionSchema = z
  .object({
    op: z.literal("exists"),
    path: z.string().min(1)
  })
  .optional();

const scheduleConfigSchema = z.object({
  cron: z.string().min(5),
  timezone: z.string().min(3).default("Europe/Kiev"),
  max_runs_per_day: z.number().int().positive().default(10),
  condition: conditionSchema,
  on_false: z.enum(["stop"]).optional()
});

const rssConfigSchema = z.object({
  rss_url: z.string().url(),
  take: z.number().int().positive().default(1),
  dedupe: z
    .object({
      enabled: z.boolean().default(true),
      uid_field: z.string().default("guid_or_link"),
      platform: z.string().default("pinterest")
    })
    .default({ enabled: true, uid_field: "guid_or_link", platform: "pinterest" }),
  mapping: z
    .object({
      title: z.string().default("title"),
      summary: z.string().default("contentSnippet"),
      link_url: z.string().default("link")
    })
    .default({ title: "title", summary: "contentSnippet", link_url: "link" }),
  condition: conditionSchema,
  on_false: z.enum(["stop"]).optional()
});

const queueConfigSchema = z.object({
  take: z.number().int().positive().default(1),
  lock_ttl_minutes: z.number().int().positive().default(30),
  only_status: z.array(z.enum(["pending", "processing", "published", "failed"])) .default(["pending"]),
  mapping: z
    .object({
      uid: z.string().default("id"),
      title: z.string().default("title"),
      summary: z.string().default("body"),
      link_url: z.string().default("link_url"),
      image_prompt: z.string().default("image_prompt")
    })
    .default({ uid: "id", title: "title", summary: "body", link_url: "link_url", image_prompt: "image_prompt" }),
  condition: conditionSchema,
  on_false: z.enum(["stop"]).optional()
});

const templateConfigSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().int().positive().optional(),
  system_prompt: z.string().optional(),
  user_prompt_template: z.string().optional(),
  fallback_to_template_step: z.boolean().optional(),
  pin_title_template: z.string().default("{title}"),
  pin_description_template: z.string().default("{summary}\n\n{link_url}"),
  hashtags: z.array(z.string()).default([]),
  max_title_len: z.number().int().positive().default(100),
  max_desc_len: z.number().int().positive().default(500),
  condition: conditionSchema,
  on_false: z.enum(["stop"]).optional()
});

const aiImageConfigSchema = z.object({
  prompt_template: z.string().min(1),
  negative_prompt: z.string().optional(),
  width: z.number().int().positive().default(1024),
  height: z.number().int().positive().default(1024),
  steps: z.number().int().positive().default(30),
  guidance_scale: z.number().positive().default(7),
  num_images: z.number().int().positive().default(1),
  timeout_seconds: z.number().int().positive().default(120),
  store: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.enum(["cloudflare_r2"]).default("cloudflare_r2"),
      path_template: z.string().default("leonardo/{date}/{flow_id}/{uid}.jpg")
    })
    .optional(),
  condition: conditionSchema,
  on_false: z.enum(["stop"]).optional()
});

const pinterestConfigSchema = z.object({
  connection_name: z.string().optional(),
  board_id: z.string().optional(),
  title_from: z.string().default("context.text.pin_title"),
  description_from: z.string().default("context.text.pin_description"),
  link_url_from: z.string().default("context.source.link_url"),
  image_url_from: z.string().default("context.image.image_url"),
  alt_text_template: z.string().default("{title}"),
  dedupe: z
    .object({
      write_published_item: z.boolean().default(true),
      platform: z.string().default("pinterest"),
      source_uid_from: z.string().default("context.source.uid")
    })
    .default({ write_published_item: true, platform: "pinterest", source_uid_from: "context.source.uid" }),
  condition: conditionSchema,
  on_false: z.enum(["stop"]).optional()
});

const delayConfigSchema = z.object({
  ms: z.number().int().nonnegative().default(0),
  condition: conditionSchema,
  on_false: z.enum(["stop"]).optional()
});

const legacyMap: Record<string, string> = {
  schedule_trigger: "schedule",
  source_rss: "rss",
  source_queue: "queue",
  ai_text: "template",
  ai_image: "ai_image_leonardo",
  publish_pinterest: "pinterest_publish",
  wait: "delay",
  sleep: "delay"
};

export function normalizeStepType(type: string) {
  return legacyMap[type] ?? type;
}

export const flowStepSchema = z
  .object({
    type: z.string().min(2),
    configJson: z.record(z.any())
  })
  .transform((step) => {
    const normalizedType = normalizeStepType(step.type);

    const parsedConfig =
      normalizedType === "schedule"
        ? scheduleConfigSchema.parse(step.configJson)
        : normalizedType === "rss"
          ? rssConfigSchema.parse(step.configJson)
          : normalizedType === "queue"
            ? queueConfigSchema.parse(step.configJson)
            : normalizedType === "template"
              ? templateConfigSchema.parse(step.configJson)
              : normalizedType === "ai_image_leonardo"
                ? aiImageConfigSchema.parse(step.configJson)
                : normalizedType === "pinterest_publish"
                  ? pinterestConfigSchema.parse(step.configJson)
                  : normalizedType === "delay"
                    ? delayConfigSchema.parse(step.configJson)
                    : (() => {
                        throw new Error(`Unsupported step type: ${step.type}`);
                      })();

    return {
      type: normalizedType,
      configJson: parsedConfig
    };
  });

export const flowStepsArraySchema = z.array(flowStepSchema);
