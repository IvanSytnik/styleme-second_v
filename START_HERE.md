# 🚀 START_HERE — Day 5

> **What's inside:** Generation history + soft delete + Regenerate.
> **Compatible with:** clean Day 4 repo (post-Day-4-merge + hotfix-429).

---

## 📦 What changes

Extract on top of your repo root. This pack is replacement + additive; the
Day 3 file layout and `page.tsx` import surface are preserved.

### Modified files (replace existing)

```
packages/shared/
├── package.json                                    ← bump 0.3.0 → 0.4.0
└── src/
    ├── types/api.ts                                ← + Generation.mode/customPrompt/deletedAt + GenerationListPage
    └── schemas/index.ts                            ← + listGenerationsQuerySchema

apps/api/src/
├── server.ts                                       ← mount generationsRouter + CORS DELETE
├── db/generations.ts                               ← insert(mode/customPrompt) + listGenerations + softDeleteGeneration
└── routes/transform.ts                             ← pass mode/customPrompt to insertGeneration

apps/web/src/
├── app/
│   ├── page.tsx                                    ← route history / history-detail
│   └── _components/
│       ├── app-header.tsx                          ← History button
│       └── app-header.module.css
├── lib/
│   ├── app-store.ts                                ← + history screens + detailGenerationId
│   └── api-client.ts                               ← listGenerations + deleteGeneration
└── features/processing/components/
    └── processing-screen.tsx                        ← invalidate generations on success
```

### New files (create)

```
supabase/migrations/
└── 20260702000000_history_and_soft_delete.sql

apps/web/src/features/history/
├── api/
│   ├── use-generations.ts                          ← useInfiniteQuery
│   └── use-delete-generation.ts                    ← optimistic delete
├── lib/
│   ├── regenerate.ts                               ← useRegenerate() helper
│   └── relative-time.ts                            ← Intl.RelativeTimeFormat wrapper
└── components/
    ├── history-screen.tsx
    ├── history-screen.module.css
    ├── history-card.tsx
    ├── history-card.module.css
    ├── history-detail-screen.tsx
    └── history-detail-screen.module.css

docs/adr/
└── 008-history-and-soft-delete.md
```

### Untouched

Backend: middleware, lib/*, other routes.
Frontend: catalog/, upload/, result/, theme/, all providers.

---

## ⚙️ Install

```bash
cd ~/Downloads/styleme-second_v

# 1. New feature branch
git checkout main && git pull
git checkout -b day-5/history

# 2. Extract
unzip -o ~/Downloads/styleme-v3-day5.zip -d .

# 3. Install (no new deps)
npm install

# 4. Rebuild shared (new types)
npm run build:shared

# 5. Apply the migration
#    Option A — Supabase Dashboard → SQL Editor → paste contents of
#    supabase/migrations/20260702000000_history_and_soft_delete.sql → Run
#
#    Option B — psql / supabase CLI if you have it wired up
```

**Migration is idempotent** — safe to run multiple times. Verify in the
SQL editor:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'generations'
order by ordinal_position;
```

You should see `mode`, `custom_prompt`, `deleted_at`.

---

## ✅ E2E smoke checklist

Two terminals as usual (`npm run dev:api`, `npm run dev:web`).

1. **Header** — new **🕘 History** button appears next to Watch ad.

2. **Empty state.** Fresh account → History → "No generations yet" with
   Try-your-first-hairstyle CTA. Click → goes to Upload.

3. **Populate.** Do 1 preset + 1 custom + 1 reference generation.

4. **History grid.** Open History → 3 cards, most-recent first. Result
   image, name, "just now" / "2 minutes ago".

5. **Custom label.** The custom card shows the prompt text (truncated),
   not "Custom style".

6. **Detail.** Click any card → full-screen detail with mode badge,
   date, big image, 3 actions + Delete.

7. **Regenerate.** Click Regenerate on a preset card → toast "Upload a
   photo to try …" → Upload screen appears with your selected style
   already in the store. Upload → catalog is pre-selected → Generate.

8. **Download.** Downloads a `styleme-<name>.jpg` file.

9. **Share.** On mobile → native share sheet. Desktop → toast "Link
   copied".

10. **Delete.**
    - Tap Delete → button becomes red "Tap again to confirm delete" + Cancel appears.
    - Tap Cancel → back to normal.
    - Tap Delete twice → row disappears instantly (optimistic), toast
      "Generation deleted", you land back on History with one fewer card.
    - Refresh page → the deleted row stays gone (soft-delete persisted).

11. **Infinite scroll.** If you have 20+ generations, scrolling near the
    bottom loads the next page automatically. "Loading more…" briefly.
    When you reach the end → "You've seen everything."

12. **DB check.**
    ```sql
    select id, mode, style_name, custom_prompt, deleted_at, created_at
    from public.generations
    order by created_at desc
    limit 10;
    ```
    - `mode` present on all new rows
    - `custom_prompt` only for `mode='custom'`
    - `deleted_at` for the row you deleted

13. **Build.**
    ```bash
    npm run build:shared
    (cd apps/web && npm run build)
    (cd apps/api && npm run build)
    ```
    Zero warnings/errors.

---

## 🐛 If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| History screen 500s | Migration not applied | Run the SQL from supabase/migrations/ |
| `custom_prompt` column not found | Same as above | Run the migration |
| Delete button no-op | Not authenticated | Refresh page (Supabase session might be stale) |
| Cards missing / grid empty despite generations existing | Cache staleness | History screen focuses → refetch triggers; if not, hard refresh |
| CORS error on DELETE | Server not restarted after changes | Restart `dev:api` |
| `Module not found: '@styleme/shared'` | Forgot `npm run build:shared` | Rebuild |
| Migration fails on `alter column mode set not null` | Old rows with NULL mode existed but backfill was skipped | Re-run migration — it's idempotent |

---

## 📝 Update memory after successful smoke

`PROJECT_MEMORY.md`:
- Move Day 5 from `In Progress` → `Completed`
- Under **Architecture Decisions** add:
  `- ADR-008 — Day 5 (history + soft delete + regenerate)`
- Bump `@styleme/shared` note to v0.4.0

---

## 🚦 Ready for Day 6?

When smoke is green → merge to main → ready for Day 6 (AdSense rewarded video).

```bash
git add -A
git commit -m "feat(day-5): history + soft delete + regenerate

- schema: mode enum, custom_prompt, deleted_at + partial index + DELETE RLS
- api: /api/generations GET (cursor paginated) + DELETE
- transform: record mode + customPrompt on insert
- web: features/history/ with useInfiniteQuery + optimistic delete
- header: History button
- store: history + history-detail screens

Ref: docs/adr/008-history-and-soft-delete.md"

git push -u origin day-5/history
git checkout main
git merge day-5/history
git push
git branch -d day-5/history
git push origin --delete day-5/history
```
