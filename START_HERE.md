# START_HERE — Day 7 (i18n + доменные швы 2–3) — ПОЛНЫЙ ПАК

> Wave 1 + Wave 2 + hotfix (middleware→proxy) объединены. Все известные
> user-facing строки покрыты. Оставшиеся английские строки — 3
> задокументированных residual gap'а в
> `docs/adr/010-i18n-catalog-data-model.md` (низкий риск, не блокируют
> мёрдж).

## ⚡ Если у тебя уже стоит предыдущий пак (Wave 1/2)

```bash
rm apps/web/src/middleware.ts
```
Скопировать новый `apps/web/src/proxy.ts` — см. секцию 2. Причина:
Next.js 16 переименовал `middleware.ts` → `proxy.ts` (тот же функционал,
другое имя файла); старый файл будет молча проигнорирован в будущей
версии Next без ошибки сборки. Подробности — ADR-010, "Post-delivery
hotfix".



## 1. Установка зависимости

```bash
cd apps/web
npm install next-intl
```

## 2. Новые файлы (просто скопировать)

```
apps/web/src/proxy.ts
apps/web/src/i18n/routing.ts
apps/web/src/i18n/request.ts
apps/web/src/messages/en.json
apps/web/src/messages/de.json
apps/web/src/messages/uk.json
apps/web/src/messages/ru.json
apps/web/src/app/[locale]/layout.tsx
apps/web/src/app/[locale]/page.tsx
apps/web/src/features/catalog/lib/use-style-display-name.ts
apps/web/src/features/theme/components/language-switcher.tsx
apps/web/src/features/theme/components/language-switcher.module.css
docs/adr/010-i18n-catalog-data-model.md
```

## 3. Заменяемые файлы (перезаписать целиком)

```
packages/shared/src/hairstyles/ui.ts
packages/shared/src/hairstyles/prompts.ts
packages/shared/src/types/api.ts
apps/api/src/routes/transform.ts
apps/web/next.config.ts
apps/web/src/lib/app-store.ts
apps/web/src/lib/error-messages.ts
apps/web/src/features/history/lib/relative-time.ts
apps/web/src/app/_components/app-header.tsx
apps/web/src/features/catalog/components/catalog-screen.tsx
apps/web/src/features/catalog/components/gallery-view.tsx
apps/web/src/features/catalog/components/mode-selector.tsx
apps/web/src/features/catalog/components/custom-prompt-view.tsx
apps/web/src/features/catalog/components/reference-photo-view.tsx
apps/web/src/features/processing/components/processing-screen.tsx
apps/web/src/features/result/components/result-screen.tsx
apps/web/src/features/rewards/components/watch-ad-button.tsx
apps/web/src/features/rewards/components/dev-ad-modal.tsx
apps/web/src/features/upload/components/upload-screen.tsx
apps/web/src/features/history/components/history-screen.tsx
apps/web/src/features/history/components/history-card.tsx
apps/web/src/features/history/components/history-detail-screen.tsx
apps/web/src/features/theme/components/theme-switcher.tsx
apps/web/src/features/theme/theme-provider.tsx
apps/web/src/features/rewards/api/use-ad-reward.ts
```

## 4. ОБЯЗАТЕЛЬНО удалить (иначе два конкурирующих route-дерева)

```bash
rm apps/web/src/app/page.tsx
rm apps/web/src/app/layout.tsx
```

`apps/web/src/app/globals.css`, `apps/web/src/app/page.module.css` и
`apps/web/src/app/_components/` **остаются на месте** — они не
locale-specific, просто импортируются из нового `[locale]/` с `../`.

## 5. Пересобрать shared

```bash
npm run build:shared
```

## 6. Известные breaking changes в сигнатурах (проверить все места использования)

| Было | Стало |
|---|---|
| `useAppStore().setResult(url, styleName)` | `setResult(url)` |
| `useAppStore().resultStyleName` | **удалено** — используй `useStyleDisplayName(...)` |
| `describeError(err)` | `describeError(err, t)` — `t = useTranslations('errors')` |
| `relativeTime(iso)` | `relativeTime(iso, locale)` — `locale = useLocale()` |
| `getPromptById(id)` (shared/hairstyles/prompts) | `getPrompt('hairstyle', id)` (алиас оставлен как deprecated) |

## 7. Важная находка (не пропустить при ревью)

`history-card.tsx` и `history-detail-screen.tsx` раньше показывали
`Generation.styleName` напрямую пользователю — это была **регрессия
против ADR-010 D3** (styleName — debug-label, не UI-текст), незаметная
до просмотра этих файлов. Исправлено переиспользованием
`useStyleDisplayName`. Проверить при code review отдельно — это баг,
который не ловится TypeScript (строка есть, тип корректен, просто
семантически неверно show'ить debug-label).

## 8. E2E smoke checklist (обязательно перед мёрджем)

- [ ] `npm run build:shared && npm run typecheck` — zero errors в web и api
- [ ] `npm run dev`, зайти на `/`, `/de`, `/uk`, `/ru` — каждый рендерит
      СВОИ строки (проверка живучести Turbopack-кэша после удаления
      старых `app/page.tsx`/`layout.tsx`)
- [ ] `LanguageSwitcher` в хедере — URL меняется, Zustand-экран НЕ
      сбрасывается
- [ ] Полный flow: upload → gallery → пресет → generate → subtitle на
      processing переведён → тот же язык на result
- [ ] Custom prompt flow — placeholder на текущем языке, текст
      пользователя НЕ переводится, submit-кнопка переведена
- [ ] Reference photo flow — intro/hint/submit переведены, generic
      result label переведён (не литерал `'Reference photo'`)
- [ ] Upload screen — заголовок/подсказки/privacy-текст переведены на
      всех 4 языках
- [ ] **История: открыть History → карточки показывают ПЕРЕВЕДЁННОЕ
      имя пресета (не английский canonical name), relative time на
      текущем языке** — это прямая проверка находки из п.7
- [ ] История-detail: mode badge переведён, share/download/delete на
      текущем языке, download filename использует переведённое имя
- [ ] Пустая история / ошибка загрузки истории — переведены
- [ ] Theme switcher — Light/System/Dark переведены
- [ ] Сработавшая ошибка (погасить квоту) — заголовок/текст на текущем
      языке (кроме 3 residual gaps из ADR-010 — это ожидаемо)
- [ ] Watch-ad dev-modal — все строки на текущем языке
- [ ] `git diff --cached | grep -iE "(SUPABASE_SERVICE_ROLE|REPLICATE_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|eyJ[A-Za-z0-9_-]{20,})"` — пусто

## 9. Известный технический долг

- `de.json` / `uk.json` — черновой перевод от Claude, не вычитан
  носителем. Пригодно для demo/dev, требует ревью перед публичным
  запуском.
- 3 residual gap'а (Zod-сообщения в `transformCustomSchema`, ошибки
  `image-resize.ts`, неполное покрытие `ERROR_CODES`) — см.
  `docs/adr/010-i18n-catalog-data-model.md`, секция "Residual gaps".
  Рекомендовано закрыть в Day 8 pre-tests cleanup, не блокирует мёрдж.
- RSC-миграция сознательно не включена (см. ADR-010, Future
  Improvements) — отдельное решение на будущее.

## Future Improvements (не в скоупе Day 7)

- Рассмотреть частичную миграцию на React Server Components — начиная
  с `app/[locale]/layout.tsx`, который уже async server component;
  остальной UI остаётся client-driven (Zustand) до Day 9 URL routing.
- `getPromptById` deprecated-алиас убрать в Day 8 после
  `grep -r getPromptById apps/`.
- Domain seam 1 (`domain` column миграция) — Day 9, как и планировалось.
- Закрыть 3 residual gap'а (см. выше) до продакшн-релиза.

