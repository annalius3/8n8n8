# Автопостинг Flow

MVP-сервис потокового автопостинга в стиле упрощённого n8n.

## Стек
- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- shadcn/ui + Tailwind
- Авторизация: magic link

## Сущности Prisma
- User
- Connection (`provider`, `name`, `encrypted_json`)
- Flow
- FlowStep
- FlowSchedule (`max_runs_per_day`)
- PostQueueItem
- PublishedItem
- JobRun
- JobRunStep

## Возможности
- `/flows` — список потоков, запуск вручную, включение и выключение
- `/flows/new` — мастер создания потока
- `/flows/[id]` — редактор шагов списком, без drag&drop
- `/runs` — история запусков и шагов
- Планировщик проверяет `flow_schedules.next_run_at <= now` и запускает подходящие потоки
- Runner выполняет шаги последовательно и хранит единый JSON `context`
- Дедупликация RSS по `published_items`
- Блокировка элементов очереди через `locked_at`
- Healthcheck `GET /api/health` для проверки env и базы данных

## Поддерживаемые типы шагов
- `schedule`
- `rss`
- `queue`
- `template`
- `ai_image_leonardo`
- `pinterest_publish`
- `delay`

Поддерживаются и старые алиасы: `schedule_trigger`, `source_rss`, `source_queue`, `ai_text`, `ai_image`, `publish_pinterest`, `wait`, `sleep`.

## Безопасность
- Секреты подключений шифруются через AES-256-GCM с `ENCRYPTION_KEY`
- Токены не отдаются на клиент
- `POST /api/scheduler/tick` защищён через `SCHEDULER_TOKEN` или авторизованного пользователя
- Серверные env проходят централизованную валидацию

## Переменные окружения
Обязательные:
- `DATABASE_URL`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `SCHEDULER_TOKEN`

Опциональные интеграции:
- `LEONARDO_API_KEY` — для шага `ai_image_leonardo`
- `OPENAI_API_KEY` — если используете `provider=openai` в шаге `template`
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` — если хотите складывать изображения Leonardo в Cloudflare R2
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

5. Открыть `http://localhost:3000/login`, ввести `owner@autoposting.local` или любой свой email и перейти по сгенерированной magic link.

## Продакшен-чеклист
1. В Vercel выставить `Framework Preset = Next.js`
2. Оставить `Output Directory` пустым
3. Добавить обязательные env в Vercel
4. Добавить `DATABASE_URL` в GitHub Secrets для workflow `Prisma Migrate Deploy`
5. Добавить `APP_BASE_URL` и `SCHEDULER_TOKEN` в GitHub Secrets для scheduler workflow
6. После деплоя проверить `GET /api/health`

## GitHub Actions
- `.github/workflows/build.yml` — сборка на каждый push и pull request
- `.github/workflows/prisma-migrate.yml` — автоматический `prisma migrate deploy` на `main`
- `.github/workflows/scheduler-tick.yml` — внешний cron для Vercel

## Бесплатный продакшен: Vercel + GitHub Actions
Если компьютер выключен, автоматизация может работать так:

1. Деплой приложения в Vercel
2. Добавление env-переменных в Vercel
3. Добавление secrets в GitHub:
- `APP_BASE_URL` = `https://ваш-проект.vercel.app`
- `SCHEDULER_TOKEN` = тот же токен, что в Vercel
- `DATABASE_URL` = production строка подключения к Postgres
4. Включение workflow `.github/workflows/scheduler-tick.yml`

Workflow вызывает:
- `POST {APP_BASE_URL}/api/scheduler/tick`
- заголовок `x-scheduler-token: {SCHEDULER_TOKEN}`

## Ручной запуск планировщика
```bash
curl -X POST https://ваш-домен.vercel.app/api/scheduler/tick \
  -H "x-scheduler-token: ВАШ_ТОКЕН"
```

## Проверка работы
1. Откройте `/flows` и нажмите «Запустить» на демо-потоке
2. Откройте `/runs` и проверьте `job_runs` и `job_run_steps`
3. Вызовите `scheduler/tick` вручную и убедитесь, что появились новые запуски
4. Откройте `/api/health` и убедитесь, что `ok: true`

