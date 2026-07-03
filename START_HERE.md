# 🚀 START_HERE — Day 6

> **What's inside:** Rewarded ads — live Watch-ad button, nonce-protected
> grant endpoint, dev ad provider, GPT skeleton.
> **Compatible with:** clean Day 5 repo (post-merge).

---

## 📦 What changes

### Modified files (replace existing)

```
packages/shared/
├── package.json                            ← bump 0.4.0 → 0.5.0
└── src/
    ├── constants/limits.ts                 ← + AD_REWARDS + AD_* error codes
    ├── schemas/index.ts                    ← grantRewardSchema: token → nonce
    └── types/api.ts                        ← + AdSession

apps/api/src/
├── lib/redis.ts                            ← del typed Promise<number> (burn arbiter)
└── routes/billing.ts                       ← + ad-session endpoint, nonce-verified grant (prod-enabled)

apps/web/src/
├── app/_components/app-header.tsx          ← WatchAdButton component
├── lib/env.ts                              ← + NEXT_PUBLIC_AD_PROVIDER
├── lib/api-client.ts                       ← + startAdSession, grantReward(nonce)
└── lib/error-messages.ts                   ← + AD_SESSION_INVALID, AD_CAP_REACHED
```

### New files

```
apps/api/src/lib/ad-session.ts              ← nonce lifecycle (issue/claim/burn)

apps/web/src/features/rewards/
├── api/use-ad-reward.ts                    ← session → watch → claim orchestration
├── components/
│   ├── watch-ad-button.tsx                 ← provider-aware live button
│   ├── watch-ad-button.module.css
│   ├── dev-ad-modal.tsx                    ← 15s countdown fake ad
│   └── dev-ad-modal.module.css
└── lib/gpt-provider.ts                     ← GPT skeleton with TODO

docs/adr/009-rewarded-ads.md
```

### Untouched
transform routes, quota.ts internals, history feature, catalog, all providers.

---

## ⚙️ Install

```bash
cd ~/Downloads/styleme-second_v
git checkout main && git pull
git checkout -b day-6/rewarded-ads

unzip -o ~/Downloads/styleme-v3-day6.zip -d .

npm install          # no new deps — sanity only
npm run build:shared # new constants/types/schemas
```

No DB migration this time — everything lives in Redis.

**env:** nothing to add for dev (`NEXT_PUBLIC_AD_PROVIDER` defaults to `dev`).
For production remember: set `NEXT_PUBLIC_AD_PROVIDER=off` on Vercel until
GPT is approved.

---

## ✅ E2E smoke checklist

Terminals as usual (`dev:api` + `dev:web`), hard refresh.

1. **Button is live.** Header shows **🎬 Watch ad +1** (accent-coloured,
   clickable) instead of the grey "Soon" chip.

2. **Happy path.** Click → dev-ad modal appears (DEV AD badge, fake video,
   progress bar). Wait 15 s → "Reward unlocked!" → **Claim +1 credit 🎉**
   → toast "+1 credit earned!" → header Bonus counter shows +1.

3. **Early dismiss.** Click Watch ad → immediately press **Close (no reward)**
   (or Escape) → modal closes, **no credit granted**, no error.

4. **Server enforces the timer** (the real test). In DevTools Console:
   ```js
   const r1 = await fetch('http://localhost:3001/api/billing/ad-session', {
     method: 'POST',
     headers: { Authorization: 'Bearer ' + (await window.__getToken?.() ?? prompt('paste token')) },
   }).then(r => r.json());
   // Claim IMMEDIATELY — before 15 s:
   const r2 = await fetch('http://localhost:3001/api/billing/grant-reward', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + prompt('same token') },
     body: JSON.stringify({ nonce: r1.data.nonce }),
   }).then(r => r.json());
   console.log(r2); // → success:false, code:AD_SESSION_INVALID ("watch the full ad")
   ```
   (Проще: возьми Bearer из любого запроса в Network tab.)

5. **Replay is dead.** Complete one honest view (step 2), then re-claim the
   same nonce via console → `AD_SESSION_INVALID`.

6. **Daily cap.** Watch 10 ads (или временно поставь `MAX_VIEWS_PER_DAY: 2`
   в shared + `npm run build:shared` + restart api). 11-й (3-й) клик по
   Watch ad → toast "Daily ad limit reached…", модалка не открывается.

7. **Reward actually spends.** Set free quota exhausted (3 generations),
   earn +1 via ad, generate → works, Bonus decrements.

8. **Builds.**
   ```bash
   npm run build:shared
   (cd apps/web && npm run build)
   (cd apps/api && npm run build)
   ```

---

## 🐛 If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| Button still shows "Soon" | `NEXT_PUBLIC_AD_PROVIDER=off` in .env.local | Remove the var or set `dev`; restart dev:web |
| `AD_SESSION_INVALID` on honest claim | api using stale shared build | `npm run build:shared` + restart api |
| Claim succeeds instantly (no 15s check) | Old billing.ts still in place | Verify unzip replaced apps/api/src/routes/billing.ts |
| Modal never unlocks | System clock skew between issue and claim | Check machine time; TTL math is server-side epoch ms |
| Cap never triggers | Redis in-memory fallback resets on api restart | Expected in dev without Upstash creds |

---

## 📝 Memory updates after smoke

`PROJECT_MEMORY.md`: Day 6 → Completed; add
`- ADR-009 — Day 6 (rewarded ads: nonce contour, provider abstraction)`;
shared → v0.5.0.

**Important for prod runbook (Day 9):** `NEXT_PUBLIC_AD_PROVIDER=off` on
Vercel until Ad Manager approval, then `gpt`.

---

## 🚦 Commit + merge

```bash
git add -A
git diff --cached | grep -iE "(SUPABASE_SERVICE_ROLE|REPLICATE_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|eyJ[A-Za-z0-9_-]{20,})" | head -5
# пусто → коммитим

git commit -m "feat(day-6): rewarded ads — nonce contour + provider abstraction

- shared 0.5.0: AD_REWARDS params, AD_* error codes, AdSession type,
  grantRewardSchema token→nonce
- api: lib/ad-session.ts (issue/claim, user-bound nonce, min-watch-time,
  daily cap, atomic burn via DEL return value); billing grant-reward
  prod-enabled (nonce contour replaces the 501 gate)
- web: features/rewards/ — WatchAdButton (dev|gpt|off providers),
  DevAdModal 15s countdown, GPT skeleton with TODO
- SSV clarification: web has no signed callbacks (AdMob-only mechanism);
  documented in ADR-009

Ref: docs/adr/009-rewarded-ads.md"

git push -u origin day-6/rewarded-ads
git checkout main && git merge day-6/rewarded-ads && git push
git branch -d day-6/rewarded-ads
git push origin --delete day-6/rewarded-ads
```

Then → **Day 7: i18n (en/de/uk/ru)**.
