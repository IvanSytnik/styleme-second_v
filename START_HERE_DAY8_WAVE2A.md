# Day 8 — Wave 2a: Playwright E2E + Replicate mock + i18n middleware fix

**Ветка:** `day-8/e2e` от main. Пак распаковывается в корень репо.

## ВАЖНО: найден отсутствующий файл (шаг 0)

`apps/web/src/middleware.ts` не существует в репо, хотя обязателен для
next-intl контура (`/` → en, определение языка, cookie-sync, `/en` → `/`).
Вероятно потерян при применении Day 7 пака (LESSONS_LEARNED §5 — тихие
сбои копирования). Этот пак его добавляет.

**Шаг 0 — до распаковки** зафиксируй текущее поведение (для понимания, был
ли прод-баг): запусти `npm run dev:web` и открой `http://localhost:3000/`.
Запомни: открывается английская версия или 404/redirect? Напиши мне результат
вместе с итогами прогона — это важно для оценки, что реально видели бы юзеры.

## Файлы

**ЗАМЕНИТЬ:**
- `apps/api/src/env.ts` — + `REPLICATE_MOCK` (enum '0'/'1') + prod-guard: NODE_ENV=production + MOCK=1 → процесс не стартует.
- `apps/api/src/routes/transform.ts` — mock-ветка в `runReplicateWithRetry` (3 строки + импорты; остальное идентично Wave 1).
- `apps/web/package.json` (v3.4.0: + @playwright/test, e2e scripts)
- `.github/workflows/ci.yml` — + job `e2e` (non-blocking пока; unit job без изменений)

**НОВЫЕ:**
- `apps/web/src/middleware.ts` — канонический next-intl middleware (bugfix)
- `apps/api/src/lib/replicate-mock.ts`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/{helpers.ts, happy-path.spec.ts, locale.spec.ts, quota.spec.ts}`
- `apps/web/e2e/fixtures/test-face.jpg` — синтетический портрет (не реальный человек)
- `apps/web/.env.e2e.example`
- `docs/adr/012-e2e-replicate-mock.md`

**НЕ ТРОНУТЫ:** все Wave 1 файлы, quota/ad-session/redis, весь UI.

## Шаги

1. Шаг 0 выше (поведение `/` ДО пака).
2. `git checkout -b day-8/e2e && unzip -o styleme-v3-day8-wave2a.zip`
3. `npm install` → появится @playwright/test
4. `npx playwright install chromium` (из `apps/web/`) — скачает браузер (~150 MB, один раз)
5. `cp apps/web/.env.e2e.example apps/web/.env.e2e` → впиши anon key (Supabase dashboard → Settings → API)
6. Прогон:
   ```zsh
   set -a; source apps/web/.env.e2e; set +a
   npm run e2e --workspace=@styleme/web
   ```
   Ожидай: Playwright сам поднимет api (порт 3001, mock) и web (3000), затем 6 тестов: 1 happy-path + 4 locale + 1 quota. Все зелёные, ~2–4 мин.
   ⚠️ Если заняты порты 3000/3001 — убей зомби (`lsof -ti:3001 | xargs kill -9`).
   ⚠️ Если happy-path падает на выборе стиля ("Classic Bob" не найден) — пришли мне `apps/web/src/features/catalog/components/gallery-view.tsx`, поправлю селектор (я строил его по aria-меткам из en.json, сам файл не видел).
7. Ручной smoke локалей (30 сек): `/`, `/ru`, `/de`, `/uk` в браузере + переключатель языка в хедере.
8. GitHub secrets: `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`.
9. Secret-scan, commit, push, PR → в Actions должны появиться два job'а: `ci` (блокирующий) и `e2e` (пока non-blocking).
10. Merge → main.

## Безопасность мока

`REPLICATE_MOCK=1` в production невозможен: env.ts убивает процесс на старте с внятной ошибкой. В E2E service-role key намеренно отсутствует → вставки в generations самоскипаются → тестовый мусор не попадает в реальную таблицу.
