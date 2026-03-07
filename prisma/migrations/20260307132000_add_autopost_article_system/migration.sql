CREATE TYPE "AutoPostJobStatus" AS ENUM (
  'pending',
  'generated',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'skipped',
  'disabled'
);

CREATE TYPE "SocialPlatform" AS ENUM (
  'twitter',
  'linkedin',
  'reddit',
  'telegram',
  'pinterest',
  'medium',
  'facebook'
);

CREATE TABLE "article_source_configs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'rss',
  "rss_url" TEXT,
  "base_url" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "immediate_publish_enabled" BOOLEAN NOT NULL DEFAULT false,
  "assets_persistence_enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_scanned_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "article_source_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "articles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'rss',
  "source_uid" TEXT NOT NULL,
  "canonical_url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL,
  "autopost_enabled" BOOLEAN NOT NULL DEFAULT true,
  "assets_generated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "autopost_platform_settings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "max_posts_per_day" INTEGER NOT NULL DEFAULT 10,
  "min_interval_minutes" INTEGER NOT NULL DEFAULT 30,
  "require_approval" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "autopost_platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "autopost_jobs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "article_id" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "status" "AutoPostJobStatus" NOT NULL DEFAULT 'pending',
  "generated_content" JSONB,
  "external_post_id" TEXT,
  "error_message" TEXT,
  "scheduled_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "autopost_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "autopost_assets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "article_id" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "hashtags" TEXT[],
  "image_prompt" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "autopost_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "autopost_subreddit_mappings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category" TEXT,
  "keyword" TEXT,
  "subreddit" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "manual_only" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "autopost_subreddit_mappings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "article_source_configs_user_id_enabled_idx" ON "article_source_configs"("user_id", "enabled");
CREATE INDEX "articles_user_id_published_at_idx" ON "articles"("user_id", "published_at");
CREATE INDEX "articles_user_id_autopost_enabled_idx" ON "articles"("user_id", "autopost_enabled");
CREATE INDEX "autopost_platform_settings_user_id_enabled_idx" ON "autopost_platform_settings"("user_id", "enabled");
CREATE INDEX "autopost_jobs_user_id_platform_status_scheduled_at_idx" ON "autopost_jobs"("user_id", "platform", "status", "scheduled_at");
CREATE INDEX "autopost_jobs_article_id_status_idx" ON "autopost_jobs"("article_id", "status");
CREATE INDEX "autopost_assets_article_id_platform_idx" ON "autopost_assets"("article_id", "platform");
CREATE INDEX "autopost_subreddit_mappings_user_id_is_enabled_idx" ON "autopost_subreddit_mappings"("user_id", "is_enabled");

CREATE UNIQUE INDEX "articles_user_id_source_type_source_uid_key" ON "articles"("user_id", "source_type", "source_uid");
CREATE UNIQUE INDEX "autopost_platform_settings_user_id_platform_key" ON "autopost_platform_settings"("user_id", "platform");
CREATE UNIQUE INDEX "autopost_jobs_article_id_platform_key" ON "autopost_jobs"("article_id", "platform");

ALTER TABLE "article_source_configs"
  ADD CONSTRAINT "article_source_configs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "articles"
  ADD CONSTRAINT "articles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "autopost_platform_settings"
  ADD CONSTRAINT "autopost_platform_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "autopost_jobs"
  ADD CONSTRAINT "autopost_jobs_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "autopost_assets"
  ADD CONSTRAINT "autopost_assets_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "autopost_subreddit_mappings"
  ADD CONSTRAINT "autopost_subreddit_mappings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
