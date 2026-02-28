-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('pending', 'processing', 'published', 'failed');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('success', 'failed', 'running');

-- CreateEnum
CREATE TYPE "StepExecStatus" AS ENUM ('success', 'failed', 'skipped');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "encrypted_json" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flows" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flow_steps" (
  "id" TEXT NOT NULL,
  "flow_id" TEXT NOT NULL,
  "order_index" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "config_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flow_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flow_schedules" (
  "id" TEXT NOT NULL,
  "flow_id" TEXT NOT NULL,
  "cron" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Kiev',
  "max_runs_per_day" INTEGER NOT NULL DEFAULT 10,
  "next_run_at" TIMESTAMP(3) NOT NULL,
  "last_run_at" TIMESTAMP(3),
  "is_paused" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "flow_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "post_queue_items" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "QueueStatus" NOT NULL DEFAULT 'pending',
  "locked_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "error" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link_url" TEXT,
  "image_prompt" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "post_queue_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "published_items" (
  "id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_uid" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "platform_post_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "published_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_runs" (
  "id" TEXT NOT NULL,
  "flow_id" TEXT NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'running',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "error" TEXT,
  "context_json" JSONB,
  CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_run_steps" (
  "id" TEXT NOT NULL,
  "job_run_id" TEXT NOT NULL,
  "step_index" INTEGER NOT NULL,
  "step_type" TEXT NOT NULL,
  "input_json" JSONB,
  "output_json" JSONB,
  "status" "StepExecStatus" NOT NULL,
  "error" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "job_run_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "flow_steps_flow_id_order_index_key" ON "flow_steps"("flow_id", "order_index");
CREATE UNIQUE INDEX "flow_schedules_flow_id_key" ON "flow_schedules"("flow_id");
CREATE UNIQUE INDEX "published_items_source_type_source_uid_platform_key" ON "published_items"("source_type", "source_uid", "platform");

CREATE INDEX "connections_user_id_provider_idx" ON "connections"("user_id", "provider");
CREATE INDEX "flow_steps_flow_id_type_idx" ON "flow_steps"("flow_id", "type");
CREATE INDEX "flow_schedules_next_run_at_is_paused_idx" ON "flow_schedules"("next_run_at", "is_paused");
CREATE INDEX "post_queue_items_status_locked_at_idx" ON "post_queue_items"("status", "locked_at");
CREATE INDEX "job_runs_flow_id_started_at_idx" ON "job_runs"("flow_id", "started_at");
CREATE INDEX "job_run_steps_job_run_id_step_index_idx" ON "job_run_steps"("job_run_id", "step_index");

ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flows" ADD CONSTRAINT "flows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flow_schedules" ADD CONSTRAINT "flow_schedules_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_queue_items" ADD CONSTRAINT "post_queue_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_run_steps" ADD CONSTRAINT "job_run_steps_job_run_id_fkey" FOREIGN KEY ("job_run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
