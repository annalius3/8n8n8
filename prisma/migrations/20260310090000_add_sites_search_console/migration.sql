CREATE TYPE "SearchConsolePeriod" AS ENUM ('today', 'last_7_days', 'last_28_days', 'last_3_months');

CREATE TYPE "SearchConsoleDevice" AS ENUM ('desktop', 'mobile', 'tablet', 'other');

CREATE TABLE "sites" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "notes" TEXT,
  "last_sync_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_search_console_connections" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "google_account_email" TEXT,
  "property_url" TEXT,
  "encrypted_json" TEXT NOT NULL,
  "token_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_search_console_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_search_console_daily_stats" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "clicks" DOUBLE PRECISION NOT NULL,
  "impressions" DOUBLE PRECISION NOT NULL,
  "ctr" DOUBLE PRECISION NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_search_console_daily_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_search_console_queries" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "period" "SearchConsolePeriod" NOT NULL,
  "query" TEXT NOT NULL,
  "clicks" DOUBLE PRECISION NOT NULL,
  "impressions" DOUBLE PRECISION NOT NULL,
  "ctr" DOUBLE PRECISION NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_search_console_queries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_search_console_pages" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "period" "SearchConsolePeriod" NOT NULL,
  "page_url" TEXT NOT NULL,
  "clicks" DOUBLE PRECISION NOT NULL,
  "impressions" DOUBLE PRECISION NOT NULL,
  "ctr" DOUBLE PRECISION NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_search_console_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_search_console_countries" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "period" "SearchConsolePeriod" NOT NULL,
  "country" TEXT NOT NULL,
  "clicks" DOUBLE PRECISION NOT NULL,
  "impressions" DOUBLE PRECISION NOT NULL,
  "ctr" DOUBLE PRECISION NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_search_console_countries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_search_console_devices" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "period" "SearchConsolePeriod" NOT NULL,
  "device" "SearchConsoleDevice" NOT NULL,
  "clicks" DOUBLE PRECISION NOT NULL,
  "impressions" DOUBLE PRECISION NOT NULL,
  "ctr" DOUBLE PRECISION NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_search_console_devices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sites_user_id_created_at_idx" ON "sites"("user_id", "created_at");
CREATE INDEX "sites_user_id_domain_idx" ON "sites"("user_id", "domain");
CREATE UNIQUE INDEX "site_search_console_connections_site_id_key" ON "site_search_console_connections"("site_id");
CREATE INDEX "site_search_console_connections_user_id_updated_at_idx" ON "site_search_console_connections"("user_id", "updated_at");
CREATE UNIQUE INDEX "site_search_console_daily_stats_site_id_date_key" ON "site_search_console_daily_stats"("site_id", "date");
CREATE INDEX "site_search_console_daily_stats_site_id_date_idx" ON "site_search_console_daily_stats"("site_id", "date");
CREATE UNIQUE INDEX "site_search_console_queries_site_id_period_query_key" ON "site_search_console_queries"("site_id", "period", "query");
CREATE INDEX "site_search_console_queries_site_id_period_clicks_idx" ON "site_search_console_queries"("site_id", "period", "clicks");
CREATE UNIQUE INDEX "site_search_console_pages_site_id_period_page_url_key" ON "site_search_console_pages"("site_id", "period", "page_url");
CREATE INDEX "site_search_console_pages_site_id_period_clicks_idx" ON "site_search_console_pages"("site_id", "period", "clicks");
CREATE UNIQUE INDEX "site_search_console_countries_site_id_period_country_key" ON "site_search_console_countries"("site_id", "period", "country");
CREATE INDEX "site_search_console_countries_site_id_period_clicks_idx" ON "site_search_console_countries"("site_id", "period", "clicks");
CREATE UNIQUE INDEX "site_search_console_devices_site_id_period_device_key" ON "site_search_console_devices"("site_id", "period", "device");
CREATE INDEX "site_search_console_devices_site_id_period_clicks_idx" ON "site_search_console_devices"("site_id", "period", "clicks");

ALTER TABLE "sites"
  ADD CONSTRAINT "sites_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_search_console_connections"
  ADD CONSTRAINT "site_search_console_connections_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_search_console_connections"
  ADD CONSTRAINT "site_search_console_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_search_console_daily_stats"
  ADD CONSTRAINT "site_search_console_daily_stats_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_search_console_queries"
  ADD CONSTRAINT "site_search_console_queries_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_search_console_pages"
  ADD CONSTRAINT "site_search_console_pages_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_search_console_countries"
  ADD CONSTRAINT "site_search_console_countries_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_search_console_devices"
  ADD CONSTRAINT "site_search_console_devices_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
