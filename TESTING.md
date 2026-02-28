# Testing Checklist

## After Any Code Change

1. TypeScript
```bash
npx tsc --noEmit
```

2. Mojibake / broken encoding scan
```bash
rg "пїЅ|���|����|Рў|Р°Р|РёР" app components lib prisma
```

3. Local production build
```bash
npm run build
```

4. Review changed files
```bash
git diff --stat
git status --short
```

## Frontend Smoke Test

### 1. `/flows`
Check:
- page opens
- no old `RSS -> ...` flow is shown
- buttons work:
  - `Создать поток`
  - `Настройки`
  - `Темы`
  - `Очередь`

### 2. `/flows/new`
Check:
- all Russian text renders correctly
- fields are visible:
  - `Название потока`
  - `Исходная тема`
  - `Язык`
  - `Постов в день`
  - `Timezone`
  - `Start time`
- submit creates a flow and redirects to `/flows/[id]/topics`

### 3. `/flows/[id]/topics`
Check:
- automatic topic generation starts
- polling refreshes logs
- list of topics appears
- buttons work:
  - `Выбрать все`
  - `Снять выбор`
  - `Добавить выбранные в очередь`

### 4. `/flows/[id]/queue`
Check:
- queue table renders
- columns are correct:
  - `status`
  - `topic`
  - `title`
  - `description`
  - `image`
  - `scheduled_at`
  - `published_at`
  - `error`
- buttons work:
  - `Спланировать расписание`
  - `Сгенерировать всё`
  - `Сгенерировать текст и изображение`
  - `Опубликовать выбранные`
  - `Опубликовать запланированные`
  - `Повторить с ошибкой`
  - `Удалить выбранные`
  - `Показать логи`

### 5. `/flows/[id]`
Check:
- overview page renders
- settings save correctly:
  - `Название`
  - `Язык`
  - `Постов в день`
  - `Timezone`
  - `Start time`
  - `Pinterest connection`
  - `Board ID`

### 6. `/settings`
Check:
- Leonardo key form opens
- save works
- success / error state is visible

### 7. `/connections`
Check:
- Pinterest token save works
- `Проверить Pinterest` works
- boards list is returned

### 8. `/runs`
Check:
- filters work:
  - `Все`
  - `Успешные`
  - `Ошибки`
  - `Выполняются`
- run cards render
- `Input JSON`
- `Output JSON`
- `Context JSON`

## Backend / API Checks

### 9. Health
```bash
curl -s https://YOUR_DOMAIN/api/health
```
Check:
- `"ok": true`
- `database.ok = true`

### 10. Flow creation
Check:
- `POST /api/flows`
- creates only the flow
- does not trigger old RSS logic

### 11. Topic generation
Check:
- `POST /api/flows/[id]/topics/generate`
- creates `JobRun`
- creates `JobRunStep(topic_generation)`
- creates 50 `TopicSuggestion`

### 12. Add to queue
Check:
- `POST /api/flows/[id]/topics/add-to-queue`
- creates queue items
- does not create duplicates for the same topic

### 13. Content generation
Check:
- `POST /api/flows/[id]/queue/generate`
- queue item receives:
  - `title`
  - `body`
  - `image_url`
- run steps are logged:
  - `text_generation`
  - `image_generation`

### 14. Publishing
Check:
- `POST /api/flows/[id]/queue/publish`
- item moves to `published`
- `published_at` is set
- `publish` run step is logged

### 15. Scheduler
Check:
- scheduler does not run legacy runner for new campaign flows
- autopublish only picks:
  - `status = ready`
  - `scheduled_at <= now`
  - `published_at IS NULL`

## Database / Prisma Checks

### 16. Prisma schema
```bash
npx prisma validate
npx prisma migrate status
```

### 17. Seed data
```bash
npx prisma db seed
```
Check:
- no old `RSS -> ...` demo flow is created
- seed reflects the current campaign model

## Minimal Smoke Test

1. `npx tsc --noEmit`
2. `npm run build`
3. open `/flows/new`
4. create a flow
5. wait for 50 topics
6. add topics to queue
7. generate content
8. open `/runs`

## Notes

- If only UI was changed:
  - run typecheck
  - scan for mojibake
  - open the changed page manually

- If API or services were changed:
  - run typecheck
  - run build
  - execute the matching user flow manually
  - inspect `/runs`
