# Autoposting Flow

Autoposting Flow is a Next.js + Prisma app for topic planning, queue-based content preparation, image generation, and Pinterest autoposting.

## Stack
- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- shadcn/ui + Tailwind
- Server-side auth: Google OAuth or magic link fallback

## Main pages
- `/flows` - flow list
- `/flows/new` - create a flow from one seed topic
- `/flows/[id]` - flow overview and settings
- `/flows/[id]/topics` - generate and review topic suggestions
- `/flows/[id]/queue` - queue, generation, publish, logs
- `/connections` - Pinterest OAuth / manual token connection
- `/settings` - Leonardo API key per user
- `/settings` - Leonardo keys and Reddit API credentials
- `/runs` - global run history
- `/autopost` - article auto-posting dashboard (scan, generate, publish, status/errors)

## Auth
- Google OAuth login:
  - `/api/auth/google/start`
  - `/auth/google/callback`
- Magic link fallback:
  - `/api/auth/magic-link`
  - `/auth/callback`

## Pinterest connection
- Preferred: Pinterest OAuth
  - `/api/connections/pinterest/oauth/start`
  - `/connections/pinterest/callback`
- Fallback: save an existing Pinterest access token manually on `/connections`

## Required environment variables
- `DATABASE_URL`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `SCHEDULER_TOKEN`

## Content generation
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `LEONARDO_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `PINTEREST_ACCESS_TOKEN` (optional fallback)
- `PINTEREST_BOARD_ID` (optional)
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USERNAME`
- `REDDIT_PASSWORD`
- `REDDIT_USER_AGENT`
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`
- `LINKEDIN_ACCESS_TOKEN`
- `MEDIUM_ACCESS_TOKEN`
- `FACEBOOK_PAGE_ACCESS_TOKEN`

## OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PINTEREST_CLIENT_ID`
- `PINTEREST_CLIENT_SECRET`

## Optional
- `DIRECT_URL`
- `APP_BASE_URL`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_BASE_URL`

## Local run
1. Copy env:
```bash
cp .env.example .env
```

2. Install:
```bash
npm install
```

3. Migrate and generate Prisma client:
```bash
npx prisma migrate dev
npx prisma generate
```

4. Optional seed:
```bash
npx prisma db seed
```

5. Run:
```bash
npm run dev
```

## OAuth callback URLs

### Google
- Local: `http://localhost:3000/auth/google/callback`
- Production: `https://YOUR_DOMAIN/auth/google/callback`

### Pinterest
- Local: `http://localhost:3000/connections/pinterest/callback`
- Production: `https://YOUR_DOMAIN/connections/pinterest/callback`

## Verification
1. Open `/login`
2. Sign in with Google or magic link
3. Open `/connections`
4. Connect Pinterest through OAuth
5. Open `/flows/new`
6. Create a flow and continue to `/queue`
7. Generate content
8. Publish selected items

## Article Auto-posting (new)

### How it works
1. Scheduler scans RSS source for new published articles.
2. New articles are saved in `articles`.
3. Per-platform jobs are created in `autopost_jobs`.
4. OpenAI generates platform-specific content (saved in `generated_content` and optional `autopost_assets`).
5. Due jobs are published by platform adapters.
6. All major actions are logged via `JobRun`/`JobRunStep` using a hidden system flow.

### Open `/autopost`
1. Set RSS URL and click `Сохранить источник`.
2. Click `Сканировать и добавить статьи`.
3. For an article click `Generate`.
4. Click `Publish` (or publish one platform button).
5. Read platform status badges and error column.

### API endpoints
- `POST /api/autopost/scan`
- `POST /api/autopost/generate/:articleId`
- `POST /api/autopost/publish/:articleId`
- `POST /api/autopost/publish/:articleId/:platform`
- `GET /api/autopost/status/:articleId`

### Platform behavior
- Missing credentials do not break generation.
- Publish step is safely marked `skipped` with explicit reason code.
- Pinterest currently publishes via existing Pinterest connection module.
- Telegram currently publishes via bot token/chat id.
- Reddit credentials can be saved per-user on `/settings` and are encrypted in `connections`.
- Other platforms are scaffolded with safe stub adapters and can be extended in `lib/autopost/publishers.ts`.

## Scheduler via Supabase Cron

Autopublish is triggered by calling `POST /api/scheduler/tick` with `x-scheduler-token`.

1. Keep `SCHEDULER_TOKEN` set in Vercel env.
2. Open Supabase SQL Editor and run:
   - [`scripts/supabase/setup_scheduler_cron.sql`](scripts/supabase/setup_scheduler_cron.sql)
3. In the SQL file, replace:
   - `YOUR_APP_URL` (your production domain)
   - `YOUR_SCHEDULER_TOKEN` (same value as `SCHEDULER_TOKEN`)
4. Verify job:
```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'autoposting_scheduler_tick';
```

## Telegram notifications
- If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured, the app sends a Telegram message after each successful Pinterest publish.

