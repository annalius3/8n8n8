# Autoposting Flow

MVP flow-based autoposting service (simplified n8n-like behavior).

## Stack
- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- shadcn/ui style components + Tailwind
- Auth: magic link (local, fast setup)

## Implemented entities (Prisma)
- User
- Connection (`provider`, `name`, `encrypted_json`)
- Flow
- FlowStep
- FlowSchedule (`max_runs_per_day` included)
- PostQueueItem
- PublishedItem
- JobRun
- JobRunStep

## Features
- `/flows` - list flows, run now, enable/disable
- `/flows/new` - flow creation wizard
- `/flows/[id]` - step editor (ordered list, no drag&drop) + run now
- `/runs` - run logs and step logs
- Scheduler tick API: checks `flow_schedules.next_run_at <= now` and starts due flows
- Worker runner executes step-by-step with one JSON `context`

## Step types supported
- `schedule`
- `rss`
- `queue`
- `template`
- `ai_image_leonardo`
- `pinterest_publish`
- `delay`

Legacy aliases are supported (`schedule_trigger`, `source_rss`, `source_queue`, `ai_text`, `ai_image`, `publish_pinterest`, `wait`, `sleep`).

## Security
- Connection secrets encrypted with AES-256-GCM via `ENCRYPTION_KEY`
- Tokens are never returned to client
- Scheduler endpoint protected by `SCHEDULER_TOKEN` (header `x-scheduler-token`)

## ENV
Required:
- `DATABASE_URL`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `LEONARDO_API_KEY`
- `SCHEDULER_TOKEN` (for remote scheduler calls)

Optional:
- `OPENAI_API_KEY` (for template step provider=openai)
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (for Leonardo store to R2)
- `NEXT_PUBLIC_BASE_URL`

## Local run
1. Copy env:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run migration + prisma generate + seed:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

4. Start app:

```bash
npm run dev
```

5. Open `http://localhost:3000/login`, enter `demo@autoposting.local`, open generated magic link.

## Free hosting setup (Vercel + GitHub Actions)
Use this if you want automation to work with your PC turned off.

1. Deploy app to Vercel.
2. Set Vercel env vars (`DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `LEONARDO_API_KEY`, `SCHEDULER_TOKEN`, and others you use).
3. In GitHub repo, add Actions secrets:
- `APP_BASE_URL` = `https://your-app.vercel.app`
- `SCHEDULER_TOKEN` = same value as in Vercel env
4. Enable workflow `.github/workflows/scheduler-tick.yml` (runs every 15 minutes).

Workflow calls:
- `POST {APP_BASE_URL}/api/scheduler/tick`
- Header: `x-scheduler-token: {SCHEDULER_TOKEN}`

## Scheduler/Worker options
- Self-hosted always-on worker:

```bash
npm run worker
```

- Remote trigger (for Vercel/free mode):

```bash
curl -X POST https://your-app.vercel.app/api/scheduler/tick \
  -H "x-scheduler-token: YOUR_TOKEN"
```

## Testing Run now and logs
1. Go to `/flows` and click `Run now` on demo flow.
2. Open `/runs` to inspect `job_runs` and `job_run_steps`.
3. Run scheduler manually via API call above and verify new runs appear.
