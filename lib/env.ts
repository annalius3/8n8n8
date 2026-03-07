import { getIntegrationModes } from "@/lib/integrations/runtime";
import { z } from "zod";

function emptyToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

const requiredEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z
    .string()
    .min(1, "ENCRYPTION_KEY is required")
    .refine(
      (value) => /^[0-9a-fA-F]{64}$/.test(value) || Buffer.from(value, "base64").length === 32,
      "ENCRYPTION_KEY must be 64 hex chars or 32 bytes in base64"
    ),
  SCHEDULER_TOKEN: z.string().min(16, "SCHEDULER_TOKEN must be at least 16 characters")
});

const optionalEnvSchema = z.object({
  LEONARDO_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  PINTEREST_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  PINTEREST_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  PINTEREST_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  PINTEREST_BOARD_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TELEGRAM_CHAT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  OPENAI_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  REDDIT_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  REDDIT_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  REDDIT_USERNAME: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  REDDIT_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  REDDIT_USER_AGENT: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TWITTER_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TWITTER_API_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TWITTER_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  TWITTER_ACCESS_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  LINKEDIN_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  MEDIUM_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FACEBOOK_PAGE_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  DIRECT_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
  R2_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_BUCKET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  NODE_ENV: z.enum(["development", "test", "production"]).optional()
});

const envSchema = requiredEnvSchema.merge(optionalEnvSchema);

export type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | null = null;

export function inspectServerEnv() {
  return envSchema.safeParse(process.env);
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = inspectServerEnv();
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment variables: ${message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getIntegrationStatus() {
  const modes = getIntegrationModes();

  return {
    leonardoConfigured: modes.leonardo === "real",
    openaiConfigured: modes.openai === "real",
    pinterestConfigured: modes.pinterest === "real",
    pinterestRequiresConnection: modes.pinterest === "connection_required",
    telegramConfigured: modes.telegram === "real",
    r2Configured: modes.r2 === "real",
    modes
  };
}
