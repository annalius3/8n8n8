# Autoposting Flow

Сервис для кампаний автопостинга: от Seed Topic до очереди публикаций, генерации текста/изображений и автопостинга.

## Стек
- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- shadcn/ui + Tailwind
- Авторизация: magic link

## Prisma-модели
- User
- Connection (`provider`, `name`, `encrypted_json`)
- Flow (используется как Campaign)
- TopicSuggestion
- FlowStep
- FlowSchedule
- PostQueueItem
- PublishedItem
- JobRun
- JobRunStep

## Основные страницы
- `/flows` — список campaign/flow
- `/flows/new` — wizard: Seed Topic -> Generate Top 50 Topics
- `/flows/[id]` — overview кампании + campaign settings
- `/flows/[id]/topics` — review 50 тем, поиск, Select All / Deselect All, Add Selected to Queue
- `/flows/[id]/queue` — queue pipeline, bulk generation, bulk publish, retry failed, delete selected, per-item logs
- `/settings` — Leonardo key per user
- `/runs` — глобальные логи запусков

## Новый сценарий работы
1. На `/flows/new` задайте `Seed Topic`, язык, niche, audience, tone и schedule settings.
2. Нажмите `Generate Top 50 Topics`.
3. На `/flows/[id]/topics` выберите темы и нажмите `Add Selected to Queue`.
4. На `/flows/[id]/queue`:
- `Generate text + image` или `Generate All`
- `Publish selected` или `Publish due now`
- `Plan schedule`, `Retry failed`, `Delete selected`
5. Для каждого шага создаются `JobRun` и `JobRunStep`.

## Переменные окружения
Обязательные:
- `DATABASE_URL`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `SCHEDULER_TOKEN`
- `OPENAI_API_KEY`

Для изображений:
- `LEONARDO_API_KEY`

Рекомендуется для production migrations:
- `DIRECT_URL`

Опционально:
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_BASE_URL`

## Локальный запуск
1. Скопировать env:

```bash
cp .env.example .env
```

2. Установить зависимости:

```bash
npm install
```

3. Применить миграции, сгенерировать Prisma Client и сиды:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

4. Запустить приложение:

```bash
npm run dev
```

5. Открыть `http://localhost:3000/login`, ввести email и перейти по сгенерированной magic link.

## Production
- В Vercel: `Framework Preset = Next.js`
- `Root Directory` пустой
- `Output Directory` пустой
- `Build Command` можно оставить стандартным или `npm run build`
- После деплоя проверить `GET /api/health`

## Проверка работы
1. Откройте `/flows/new` и создайте кампанию через `Generate Top 50 Topics`
2. Перейдите в `/flows/[id]/topics` и добавьте выбранные темы в queue
3. Откройте `/flows/[id]/queue` и запустите `Generate All`
4. Проверьте `/runs` и пер-item logs в queue
5. Вызовите `scheduler/tick` вручную, если включён autopublish
