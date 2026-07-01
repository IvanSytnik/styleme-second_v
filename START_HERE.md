# 🚀 START_HERE — Day 4 v2

> **What's inside:** Custom prompt + Reference photo + toast notifications + two-tier catalog. Backend untouched.
> **Compatible with:** clean Day 3 repo (verified against real Day 3 source).

---

## 📦 What changes

This pack is **replacement + additive** — extract on top of your repo root.
All web/api entry points, providers, and `page.tsx` are preserved.

### Modified files (replace existing)

```
packages/shared/
├── package.json                                    ← bump 0.2.0 → 0.3.0
└── src/
    ├── constants/limits.ts                         ← + MIN 10, MAX 200
    └── schemas/index.ts                            ← trim + new bounds

apps/web/
├── package.json                                    ← + sonner, + @hookform/resolvers
└── src/
    ├── app/
    │   ├── layout.tsx                              ← + <Toaster />
    │   └── _components/
    │       ├── app-header.tsx                      ← + Watch ad Coming Soon
    │       └── app-header.module.css               ← + watch-ad styles
    ├── features/
    │   ├── catalog/components/
    │   │   ├── catalog-screen.tsx                  ← two-tier layout (ModeSelector + views)
    │   │   └── catalog-screen.module.css           ← extended for footer
    │   └── processing/components/
    │       └── processing-screen.tsx               ← 3-mode dispatch
    └── lib/
        └── app-store.ts                            ← + mode, customPrompt, referenceImage
```

### New files (create)

```
apps/web/src/features/catalog/components/
├── mode-selector.tsx
├── mode-selector.module.css
├── gallery-view.tsx                                ← Women/Men tabs extracted
├── gallery-view.module.css
├── custom-prompt-view.tsx                          ← RHF + Zod
├── custom-prompt-view.module.css
├── reference-photo-view.tsx                        ← drag&drop + inline resize
└── reference-photo-view.module.css

docs/adr/
└── 007-day4-stack.md
```

### Untouched (Day 3 preserved)

- `apps/api/**` — backend already supports all three transform endpoints
- `apps/web/src/app/page.tsx` — routing unchanged
- `apps/web/src/lib/api-client.ts` — all three transform methods already exist
- `apps/web/src/lib/error-messages.ts` — existing `describeError()` covers our needs
- `apps/web/src/lib/auth-provider.tsx`, `query-provider.tsx`
- `apps/web/src/features/upload/**`, `features/result/**`, `features/theme/**`

---

## ⚙️ Install

```bash
# 1. Extract on top of repo root (this pack has no root folder wrapper)
cd ~/path/to/styleme-repo
unzip -o ~/Downloads/styleme-v3-day4-v2.zip -d .

# 2. Install new deps
npm install

# 3. Rebuild shared (new constants + schema bounds)
npm run build:shared
```

---

## ✅ E2E smoke checklist (run before commit)

> Lesson from Day 2: **"build green ≠ runtime green"**. Walk these 8 steps.

### Terminals

```bash
# Terminal 1 — backend
cd apps/api && npm run dev
# expect: "api listening on :3001" + "redis connected" + "supabase ok"
```

```bash
# Terminal 2 — frontend
cd apps/web && npm run dev
# expect: "Local: http://localhost:3000"
# Open browser → hard refresh (Cmd+Shift+R)
```

### Checks

1. **Upload screen** — load a selfie (drag&drop or camera). Navigates to catalog.

2. **Gallery mode** (default).
   - Three cards at top: **Gallery / Describe / Reference**. Gallery selected.
   - Women/Men tabs below.
   - Click a hairstyle card → it's highlighted.
   - Click **Generate ✨** → processing screen shows the hairstyle name
     (e.g. "Классическое каре") → result within 15–30s.

3. **Describe mode**.
   - Click **Describe** card. Textarea appears.
   - Type `hi` (2 chars) → submit disabled, help text shows `at least 10 characters`.
   - Type 10 chars → submit enabled.
   - Type 200 chars → counter shows `200 / 200` without red.
   - Type 201 chars → counter red + bold, submit disabled.
   - Submit with valid prompt → processing screen shows a truncated
     version of the prompt as subtitle → result.

4. **Reference mode**.
   - Click **Reference** card. Dropzone appears.
   - Drop a photo → preview appears.
   - Click **Try this hairstyle ✨** → processing screen shows
     "Reference photo" → result.

5. **Toasts**.
   - Reference mode: try drop-loading a `.pdf` or `.gif` → bottom-right
     toast: `Unsupported format. Please use JPEG, PNG, or WebP.`

6. **Watch ad button** (header).
   - Visible, disabled, badge **Soon**.
   - Hover → tooltip.
   - Click → **nothing happens**. Check DevTools Network — no request fires.

7. **Quota exhaustion** (optional — will burn 3 real generations).
   - Do 3 generations. On the 4th → in-processing error box shows
     "No credits left".

8. **Build**:
   ```bash
   npm run build:shared
   cd apps/web && npm run build
   cd ../api && npm run build
   ```
   All three should complete with no warnings/errors.

---

## 🐛 If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module 'sonner'` | Forgot `npm install` after unzip | `npm install` at repo root |
| `Cannot find module '@styleme/shared/...'` after edits to shared | Didn't rebuild shared | `npm run build:shared` |
| Toast doesn't show | `<Toaster />` missing from `layout.tsx` | Verify layout.tsx was replaced |
| Custom prompt not validated on server | api using stale shared build | `npm run build:shared` + restart api |
| `EADDRINUSE :::3001` | Zombie from prior run | `lsof -ti:3001 \| xargs kill -9` |
| Processing screen shows blank subtitle | store not updated to Day 4 shape | Verify `apps/web/src/lib/app-store.ts` was replaced |
| Two `styleme-v3-*` folders in same tree | Multi-lockfile bug from Next Turbopack | `rm -rf` the duplicate; keep only one repo copy |

---

## 📝 Update memory after successful smoke

In `PROJECT_MEMORY.md` → **Architecture Decisions**: add
```
- ADR-007 — Day 4 stack (sonner, RHF/Zod, two-tier catalog, mode-based dispatch)
```

Move Day 4 from `In Progress` → `Completed`.

Bump `@styleme/shared` note to v0.3.0 in the Tech Stack section.

---

## 🚦 Ready for Day 5?

When smoke is green — reply **"ready for Day 5"** and we start on generation
history from Supabase (`useInfiniteQuery` + regenerate-from-history that
re-uses the same `mode` dispatch pattern introduced here).
