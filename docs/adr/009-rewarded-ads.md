# ADR-009 — Day 6: Rewarded ads — nonce contour instead of SSV

**Status:** Accepted
**Date:** 2026-07-02

---

## Context

The original roadmap said "real AdSense rewarded integration + signed
callback on /api/billing/grant-reward". During feasibility review this
turned out to contain a platform error: **Server-Side Verification (SSV)
is an AdMob (mobile) mechanism. Web rewarded ads — GPT/Ad Manager or
AdSense — deliver the "granted" event to the browser only.** There is no
Google-signed server callback on the web.

Additionally, AdSense/Ad Manager approval requires a live public site
with content — pending our production deployment, out of our control
timeline-wise.

## Decision

### 1. Nonce contour as the security layer (not ad-network trust)

Since the client-side grant event is forgeable by design, all protection
lives server-side:

```
POST /api/billing/ad-session          → mint nonce {userId, issuedAt}, TTL 5 min
  (client shows ad, ≥15 s pass)
POST /api/billing/grant-reward{nonce} → verify: exists → user matches →
                                        ≥ MIN_WATCH_SECONDS elapsed →
                                        daily cap ok → atomic burn → +1 credit
```

**Atomic burn:** `DEL` returns the number of keys removed. Exactly one
concurrent claimant sees `1`; replays and double-clicks see `0`. Double-claim
arbitration without Lua scripts.

**Fraud economics:** a scripted attacker bypassing the client entirely
still must wait 15 real seconds per credit, capped at
`MAX_VIEWS_PER_DAY = 10` → worst case **$0.40/user/day**, further throttled
by the transform rate limit (10/hour). Acceptable blast radius; CAPTCHA/PoW
rejected as overengineering for this ceiling.

### 2. Provider abstraction with three modes

`NEXT_PUBLIC_AD_PROVIDER = dev | gpt | off`

- **dev** — built-in 15s modal simulating the rewarded-ad UX contract
  (dismissable early → no reward; reward unlocks only after countdown).
  Default in development. Lets the entire flow be smoke-tested today.
- **gpt** — Google Publisher Tag rewarded ads. Skeleton with documented
  TODO until Ad Manager approval; the adapter interface is final.
- **off** — button renders the Day 4 "Coming soon" disabled state.
  **This is the production setting** until GPT goes live, so prod users
  can't farm credits through the dev modal.

### 3. grant-reward now works in production

The old 501 gate is removed. The nonce contour IS the protection — the
endpoint no longer needs to distinguish dev/prod. Prod safety comes from
`AD_PROVIDER=off` on the frontend plus the server-side caps.

### 4. Parameters (in `AD_REWARDS`, shared)

| Param | Value | Rationale |
|---|---|---|
| CREDITS_PER_VIEW | 1 | simple mental model |
| MAX_VIEWS_PER_DAY | 10 | 3 free + 10 rewarded = 13 gen/day ceiling ($0.52 upside cost) |
| MIN_WATCH_SECONDS | 15 | typical rewarded-video floor |
| SESSION_TTL_SECONDS | 300 | ad + claim comfortably fit; stale nonces die fast |

## Consequences

### Positive
- Whole reward loop testable end-to-end today, no external approvals.
- Ad network swap = one adapter file + one env var.
- Endpoint semantics stable across environments (no isProd branching).
- Fraud ceiling is a known, small number.

### Negative / Risks
- A determined user can farm $0.40/day. Accepted; revisit if generation
  cost rises or caps grow.
- Dev modal in prod would be free credits — mitigated by `off` default
  documented in deploy runbook; **must be part of the Day 9 prod checklist**.
- `quota.grantRewarded` and the daily-view counter are separate keys —
  not transactionally atomic. Worst case on partial failure: a view is
  counted without a credit (user-hostile but self-corrects at cap reset)
  or vice versa (one free credit). Both bounded, both logged.

## Follow-up
- After Ad Manager approval: implement `showGptRewardedAd()` per the flow
  documented in the skeleton; flip prod env to `gpt`.
- Day 9 prod checklist: verify `NEXT_PUBLIC_AD_PROVIDER=off` on Vercel
  until GPT is live.
- Backlog: reward analytics (views started vs completed vs claimed) once
  real ads flow.
