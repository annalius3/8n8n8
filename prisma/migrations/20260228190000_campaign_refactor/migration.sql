ALTER TYPE "QueueStatus" ADD VALUE IF NOT EXISTS 'generating';
ALTER TYPE "QueueStatus" ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE "QueueStatus" ADD VALUE IF NOT EXISTS 'publishing';

ALTER TABLE "flows"
  ADD COLUMN "seed_topic" TEXT,
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'EN',
  ADD COLUMN "niche" TEXT,
  ADD COLUMN "audience" TEXT,
  ADD COLUMN "tone" TEXT,
  ADD COLUMN "posts_per_day" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Kiev',
  ADD COLUMN "start_time" TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN "autopublish_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "topic_suggestions" (
  "id" TEXT NOT NULL,
  "flow_id" TEXT NOT NULL,
  "topic_text" TEXT NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "topic_suggestions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "post_queue_items"
  ADD COLUMN "flow_id" TEXT,
  ADD COLUMN "topic_text" TEXT,
  ADD COLUMN "scheduled_at" TIMESTAMP(3),
  ADD COLUMN "image_url" TEXT;

ALTER TABLE "job_runs"
  ADD COLUMN "queue_item_id" TEXT;

CREATE INDEX "topic_suggestions_flow_id_created_at_idx" ON "topic_suggestions"("flow_id", "created_at");
CREATE INDEX "post_queue_items_flow_id_status_scheduled_at_idx" ON "post_queue_items"("flow_id", "status", "scheduled_at");
CREATE INDEX "job_runs_queue_item_id_started_at_idx" ON "job_runs"("queue_item_id", "started_at");

ALTER TABLE "topic_suggestions"
  ADD CONSTRAINT "topic_suggestions_flow_id_fkey"
  FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_queue_items"
  ADD CONSTRAINT "post_queue_items_flow_id_fkey"
  FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_runs"
  ADD CONSTRAINT "job_runs_queue_item_id_fkey"
  FOREIGN KEY ("queue_item_id") REFERENCES "post_queue_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
