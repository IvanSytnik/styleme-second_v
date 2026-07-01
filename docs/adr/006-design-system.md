# ADR-006 — Design System & Theming

**Status:** Accepted
**Date:** 2026-06-28

## Context

Day 3 is the first iteration that ships real user-facing screens. Until now the web app was a smoke dashboard with neutral styling. We need a deliberate visual identity, not ad-hoc CSS per feature.

## Decisions

### Visual identity

- **Brand accent:** pink → purple gradient (`#ec4899` → `#8b5cf6`). Pink alone reads "beauty product"; pairing it with purple in a gradient reads "AI product". Reuse on CTAs and accent surfaces only — neutrals everywhere else.
- **Neutrals:** Tailwind zinc scale (50–950) for surfaces and text. Warmer than slate, cooler than stone — appropriate for a product where the content (faces, hair) carries the warmth.
- **Type:** **System font stack** — `system-ui, -apple-system, "Segoe UI Variable", Roboto, sans-serif`. Modern OS fonts (San Francisco on macOS/iOS, Segoe UI Variable on Win 11, Roboto on Android) are high-quality variable fonts already installed everywhere. Zero network requests, zero render delay, zero dependency on Google Fonts (which is unreachable in some networks). A custom font (e.g. Inter via `next/font/local` with a self-hosted .woff2) is a future revisit if branding requires it — not before.
- **Radius scale:** 6 / 8 / 12 / 16 / 20 px. Inputs 8, buttons 8, cards 12, hero panels 20.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. No arbitrary values.

### Theming approach

Three modes exposed to users: **System / Light / Dark**.

System is the default; we never silently override the user's OS preference.

### Implementation: `next-themes`

We use [next-themes](https://github.com/pacocoursey/next-themes) (3 KB gzip). Rationale:

- Solves the dark-mode flash (FOUC) problem in SSR. The library injects a blocking inline `<script>` in `<head>` that reads `localStorage`/`prefers-color-scheme` and sets `data-theme` on `<html>` **before** the body renders. No hand-rolled equivalent has solved this cleanly.
- Standard in the Next.js ecosystem — well-documented, maintained by a Vercel-adjacent author.
- Three-line integration.

**Rejected alternatives:**
- Pure CSS `prefers-color-scheme` — user can't override the OS preference.
- Self-rolled provider + custom inline script — solves the same problem the library already solves; YAGNI.

### CSS strategy

- **CSS custom properties as design tokens** in `globals.css`, scoped per theme via `[data-theme="dark"]` / `[data-theme="light"]`.
- **CSS Modules** for component styles. Components only reference tokens, never literal colors.
- **No Tailwind for now.** Tailwind is a separate decision; introducing it in Day 3 alongside the first real screens would couple two large changes into one iteration. Tokens give us the same theming flexibility without the build/IDE complexity.

### Component philosophy

- Components in feature folders are private to that feature. Cross-feature primitives (Button, Card, ThemeSwitcher) live under `src/features/theme/components/` or get promoted to `src/components/ui/` only after the second feature actually needs them — not preemptively.
- Every interactive element has visible focus styles (outline) — never `outline: none` without a replacement.

## Consequences

### Positive
- Themes work without code changes when adding components.
- Token names are semantic (`--surface-1`, `--text-muted`), not chromatic (`--white`, `--zinc-50`) — renaming is local.
- Design changes in future iterations touch tokens, not every component.

### Negative
- One more dependency (`next-themes`, ~3 KB gz).
- Designers cannot directly edit CSS without understanding the token system. Acceptable for a solo project; revisit if a designer joins.

## Future revisions

- Tailwind/CVA migration is a separate decision when components multiply.
- Component library extraction (Storybook + design system package) is a Phase 6 concern, not now.
