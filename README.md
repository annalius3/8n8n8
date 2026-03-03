# Autoposting Flow

Autoposting Flow is a Next.js + Prisma app for topic planning, queue-based content preparation, image generation, and Pinterest autoposting.

## Stack
- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- shadcn/ui + Tailwind
- Server-side auth: Google OAuth or magic link fallback

## Main pages
- `/flows` — flow list
- `/flows/new` — create a flow from one seed topic
- `/flows/[id]` — flow overview and settings
- `/flows/[id]/topics` — generate and review topic suggestions
- `/flows/[id]/queue` — queue, generation, publish, logs
- `/connections` — Pinterest OAuth / manual token connection
- `/settings` — Leonardo API key per user
- `/runs` — global run history

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
- `LEONARDO_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PINTEREST_CLIENT_ID`
- `PINTEREST_CLIENT_SECRET`

## Optional
- `DIRECT_URL`
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

## Telegram notifications
- If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured, the app sends a Telegram message after each successful Pinterest publish.
