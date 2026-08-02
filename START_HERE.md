# START_HERE — Day 8 · Wave 2b (пункт 1/3): multer 1.x → 2.x

> Один topic на пак. Здесь **только** апгрейд multer + маппинг upload-ошибок.
> npm audit и next-intl cleanup — отдельными паками после.

---

## Что внутри и зачем

`multer@1.4.5-lts` тянет уязвимости класса ReDoS через свою зависимость
`dicer`. В `multer@2.x` парсер заменён на `busboy` — эти advisories закрыты.

Попутно закрыт **латентный баг**: `error-handler.ts` ловил только `HttpError`,
поэтому любая ошибка multer (превышение размера файла, неверный MIME) уходила
клиенту как `500 INTERNAL_ERROR` — без внятного кода. Теперь они мапятся в
стабильные коды envelope (`FILE_TOO_LARGE`, `UNSUPPORTED_MIME`), для которых
на вебе уже есть и behavior-таблица, и i18n-ключи во всех 4 локалях (проверено).

Веб **не менялся** — только `apps/api`.

---

## Файлы в паке (все — ЗАМЕНА существующих)

```
apps/api/package.json                      # multer ^2.2.0, @types/multer ^2.2.0, version 3.2.1
apps/api/src/middleware/error-handler.ts   # + ветки MulterError и UnsupportedMimeError
apps/api/src/routes/transform.ts           # fileFilter бросает типизированную UnsupportedMimeError
```

Ничего не переносится, entry points на месте. Zip распаковывается в корень репо.

---

## Установка (ветка → install → typecheck)

```bash
cd ~/Downloads/styleme-second_v

# 1. свежая ветка от main
git checkout main && git pull
git checkout -b day-8/wave-2b

# 2. распаковать пак поверх (перезапишет 3 файла)
#    (распакуй загруженный zip в корень репо)

# 3. поставить новый multer
npm install                       # из корня монорепо (workspaces)

# 4. пересобрать shared (на всякий) + тайпчек api
npm run build:shared
npm run typecheck -w @styleme/api
```

Ожидаемо: typecheck зелёный. `@types/multer@2.x` совместим с нашими вызовами
`.single()/.fields()/.memoryStorage()` — сигнатуры между 1.x и 2.x не менялись.

---

## SMOKE (обязательно перед commit — 4 кейса)

Подними API как обычно (реальные Upstash/Supabase env, НЕ in-memory —
in-memory маскирует поведение, проверено дважды):

```bash
# перед запуском убей зомби-процессы
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null

# подними api (dev)
npm run dev -w @styleme/api
```

Затем прогони через реальный веб-флоу (или curl'ом с валидным Bearer):

| # | Кейс | Ожидаемо |
|---|------|----------|
| 1 | **Preset**: обычное фото (JPEG/PNG/WebP <2 МБ) → выбрать стиль | `200`, картинка приходит |
| 2 | **Reference**: два фото <2 МБ | `200`, картинка приходит |
| 3 | **Oversize**: фото **>2 МБ** | `413`, `error.code === "FILE_TOO_LARGE"` |
| 4 | **Bad MIME**: загрузить `.txt`/`.pdf` под полем `image` | `400`, `error.code === "UNSUPPORTED_MIME"` |

**Критично для кейса 3:** до этого пака oversize возвращал `500`. Если после
пака всё ещё `500` — значит multer 2.x не прокинул `MulterError` (проверь, что
`npm install` реально подтянул `multer@2.x`: `npm ls multer`).

Быстрый curl для кейсов 3–4 (подставь свой токен и большой файл):

```bash
# кейс 3 — oversize (создай файл >2 МБ)
dd if=/dev/urandom of=/tmp/big.jpg bs=1024 count=3000 2>/dev/null
curl -s -X POST http://localhost:3001/api/transform \
  -H "Authorization: Bearer $TOKEN" \
  -F "styleId=1" -F "image=@/tmp/big.jpg;type=image/jpeg" | jq .error.code
# ожидаем: "FILE_TOO_LARGE"

# кейс 4 — bad MIME
echo "not an image" > /tmp/bad.txt
curl -s -X POST http://localhost:3001/api/transform \
  -H "Authorization: Bearer $TOKEN" \
  -F "styleId=1" -F "image=@/tmp/bad.txt;type=text/plain" | jq .error.code
# ожидаем: "UNSUPPORTED_MIME"
```

> Примечание по кейсу 3: multer применяет лимит **на уровне поля**, поэтому
> ошибка `LIMIT_FILE_SIZE` прилетает при парсинге, ещё до хендлера — это
> нормально. Главное, что теперь она мапится, а не падает в 500.

---

## После зелёного smoke

```bash
# secret-scan staged diff
git add -A
git diff --cached | grep -iE "(SUPABASE_SERVICE_ROLE|REPLICATE_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|eyJ[A-Za-z0-9_-]{20,})"
# (пусто = ок)

git commit -m "chore(api): bump multer 1.x->2.x, map upload errors to stable codes (Day 8 Wave 2b)"
git checkout main && git merge day-8/wave-2b && git push
```

---

## Следующий шаг

Wave 2b пункт **2/3 — npm audit triage**. Начнём с `npm audit` уже ПОСЛЕ
этого мёржа: multer-бамп сам снимет часть из 57/8-critical, так что триажить
имеет смысл по обновлённой картине. Скинешь свежий вывод `npm audit` —
разберём по одному.
