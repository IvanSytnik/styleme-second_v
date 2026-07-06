# Day 8 — Wave 1: Vitest + contract tests + CI

**Ветка:** `day-8/tests-ci` (создай от main). Пак распаковывается в корень репо.

## Файлы

**ЗАМЕНИТЬ (existing):**
- `apps/api/src/lib/redis.ts` — экспортированы RedisLike/InMemoryRedis/createUpstashRedis; `get` теперь `Promise<unknown>` (честный тип под Upstash). Рантайм-поведение не изменилось.
- `apps/api/src/lib/ad-session.ts` — логика в `createAdSessionService(redis, now?)`, старые экспорты — обёртки. Роуты не тронуты.
- `apps/api/src/lib/quota.ts` — то же + `toInt` вместо голого parseInt (Upstash возвращает числа).
- `apps/api/src/db/generations.ts` — cursor codec вынесен в lib/cursor.ts, импорт обновлён.
- `apps/api/src/routes/transform.ts` — retry-хелперы вынесены в lib/replicate-retry.ts; **фикс typo в промптах** ("thehair"→"the hair", "Keepthe"→"Keep the").
- `apps/api/package.json` (v3.2.0: +vitest, +test scripts)
- `apps/api/tsconfig.json` (exclude tests/ из build)
- `packages/shared/package.json` (v0.6.0: +vitest, +test scripts)
- `package.json` (root: +test script)

**НОВЫЕ:**
- `apps/api/src/lib/cursor.ts`, `apps/api/src/lib/replicate-retry.ts`
- `apps/api/vitest.config.ts`, `packages/shared/vitest.config.ts`
- `apps/api/tests/ad-session.contract.test.ts` (главный — dual-backend)
- `apps/api/tests/cursor.test.ts`, `apps/api/tests/replicate-retry.test.ts`
- `packages/shared/tests/schemas.test.ts`
- `.github/workflows/ci.yml`
- `docs/adr/011-testing-strategy.md`

**НЕ ТРОНУТЫ:** env.ts, logger.ts, все middleware, billing.ts, весь apps/web.

## Шаги

1. `git checkout -b day-8/tests-ci && unzip -o styleme-v3-day8-wave1.zip`
2. `npm install` (появится vitest) → ожидай чистый install
3. `npm run build:shared` → ожидай успешный tsc
4. `npm run typecheck` → все workspaces зелёные
5. **Создай тестовую Upstash БД** (отдельную! не прод): Upstash console → Create Database (free tier). Скопируй REST URL + token.
6. Локальный прогон contract-теста против реального Upstash:
   ```zsh
   export TEST_UPSTASH_REDIS_REST_URL="https://<test-db>.upstash.io"
   export TEST_UPSTASH_REDIS_REST_TOKEN="<token>"
   npm run test
   ```
   Ожидай: api — все тесты passed, 0 skipped (если secrets не заданы — 8 skipped + жёлтый warning). shared — 9 passed.
7. E2E smoke как обычно (api + web, реальные креды, полный happy path preset + rewarded ad) — рефакторинг не менял поведение, но правило есть правило.
8. GitHub → repo Settings → Secrets → Actions: добавь `TEST_UPSTASH_REDIS_REST_URL` и `TEST_UPSTASH_REDIS_REST_TOKEN` (тестовая БД).
9. Commit (secret-scan diff!), push, открой PR — CI должен пройти все шаги.
10. Merge → main → push.

## Замечено попутно (не трогал)

- В корневом `package.json` живёт `next-intl` в dependencies — видимо, случайный hoist Day 7. Правильное место — apps/web (там он уже есть). Уберём в Wave 2, отдельным однострочником.
