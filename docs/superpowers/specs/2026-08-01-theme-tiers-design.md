# Light-mode accent identity + Premium visual tier — design

## Problem

The dark theme's signature acid-green (`--lime: #c8ff2e`) is theme-invariant — it's used identically in light mode. As TEXT/foreground color (eyebrows, kickers, badges, list-bullet accents, "strong" indicators), lime has ~1.14:1 contrast against light backgrounds (`--panel #fafcf6`, `--paper #e9eee1`) — it fails WCAG badly and reads as washed-out. Separately, the user wants a "premium" visual tier for subscribers that makes the app feel like an upgraded version of itself, built on top of the existing dark-theme identity rather than replacing it.

## Decisions (from brainstorm)

1. **Keep light mode**, but give it its own signature accent instead of diluted lime.
2. **Premium is a layered visual upgrade**, not a third theme choice — same Light/Dark toggle, premium subscribers see a richer version of whichever theme they're on.
3. **Premium applies app-wide** once subscribed, not just to the report output.

## Part 1: Light-mode accent identity

New dedicated token `--accent-ink`, defined per theme in `styles/_base.scss`:
- Dark: `--accent-ink: #c8ff2e;` (same as `--lime` — dark mode's lime-as-text usage is unchanged)
- Light: `--accent-ink: #0b5e4c;` (deep teal — same value already used by light mode's existing `--teal` token, but given its own name since `--teal` already has a separate semantic role and shouldn't be redefined)

**Contrast (computed via WCAG relative-luminance formula):** `#0b5e4c` on `--panel` (#fafcf6) = 7.47:1 (passes AAA); on `--paper` (#e9eee1) = 6.54:1 (passes AA, near-AAA). Both comfortably clear the 4.5:1 AA threshold for normal text.

**Migration:** every existing `color: var(--lime)` declaration across `styles/*.scss` that sets TEXT/foreground color (eyebrows, kickers, list-bullet `::before` accents, "strong"/leak indicator text, badge text) changes to `color: var(--accent-ink)`. Every usage of `--lime` as a BACKGROUND (buttons, `--action-bg`, solid badge fills) is left untouched — those already pass contrast fine with their existing dark text, in both themes, confirmed in the brainstorm's contrast check. The implementation plan must grep `styles/*.scss` for `var(--lime)` and classify each hit as text-role vs background-role before changing it — this is mechanical but needs care since misclassifying a background usage would break an already-working color.

## Part 2: Premium visual tier

### Gating

A new client component, `components/PremiumTierGate.tsx`, mirrors the existing `components/OnboardingGate.tsx` pattern exactly: on mount, `fetch("/api/auth/me")`, and set `document.documentElement.dataset.tier = user?.subscription === "ACTIVE" ? "premium" : "free"`. Rendered in `app/layout.tsx` alongside the existing `<OnboardingGate />`. This duplicates the `/api/auth/me` fetch that `OnboardingGate` and each page's own auth loading already do independently — matching existing precedent (not a new inefficiency pattern, an existing tolerated one). No new API endpoint needed; `/api/auth/me` already returns `subscription`.

This gives every page in the app (including the marketing landing page and the report tool) a `data-tier` attribute on `<html>`, alongside the existing `data-theme` attribute, without prop-drilling subscription status through the component tree.

### What changes, concretely

Premium's visual differences are implemented almost entirely through CSS custom property overrides scoped to `:root[data-theme="X"][data-tier="premium"]` selectors in `styles/_base.scss`, so that components which already consume these tokens (`var(--panel)`, `var(--action-bg)`, etc.) upgrade automatically with no changes to their own files. A small number of tokens are new and need one-line additions to the specific rules that should render them (documented below) — these are NOT automatically applied everywhere, since e.g. gradient-text score numbers require structural CSS (`background-clip: text`) that can't come from a variable alone.

**Panels/cards (automatic, zero component changes):**
`--panel` and `--surface` become gradient values under the premium selector instead of flat colors:
- Premium dark: `--panel: linear-gradient(155deg, #101c16 0%, #0a1310 60%, #0e1914 100%);` `--surface: linear-gradient(155deg, #182922 0%, #101c16 60%, #14241d 100%);`
- Premium light: `--panel: linear-gradient(155deg, #ffffff 0%, #eef3e6 55%, #fafcf6 100%);` `--surface` gets an analogous lighter gradient.

Every existing `background: var(--panel)` / `background: var(--surface)` rule in the codebase (report cards, landing "how it works" steps, etc.) picks this up automatically.

**Buttons (automatic, zero component changes):**
`--action-bg` becomes a gradient under premium (both themes use the same lime gradient, since button color doesn't change between themes): `--action-bg: linear-gradient(135deg, #d6ff5e, #a8e600);`. `.btn--primary` in `styles/_buttons.scss` already sets `background: var(--action-bg)`, so this upgrades automatically.

**Glow shadows (needs one-line additions to specific existing rules):**
Two new tokens, defined as an inert `0 0 0 transparent` in the free tier (both themes) and a real glow in premium, so they can always be safely appended to an existing `box-shadow` list without ever producing invalid CSS:
- `--accent-glow`: free = `0 0 0 transparent`; premium dark = `0 0 12px rgba(200,255,46,0.55)`; premium light = `0 0 12px rgba(11,94,76,0.35)` (teal glow, softer since teal has lower luminance than lime).
- `--action-glow`: free = `0 0 0 transparent`; premium (both themes) = `0 4px 14px rgba(200,255,46,0.35)` (button glow stays lime-toned since the button itself stays lime in both themes).

These get appended to the existing `box-shadow` declarations on: `.btn--primary` (in `_buttons.scss`) and the report card's top accent-bar element (the plan must identify its exact selector — likely in `_report.scss`, the "2px lime top accent bar" mentioned in prior design notes) and the landing hero's accent elements. This is a small, enumerable set of edits, not a global sweep.

**Gradient-text score numbers (needs new CSS, applied to a specific set of components):**
A new token `--score-fill-gradient`: premium dark = `linear-gradient(180deg, #fbffe8, #c8ff2e)`; premium light = `linear-gradient(180deg, #14806a, #0b5e4c)`. This only has an effect where explicitly referenced — a new premium-scoped override rule needs adding to the specific score-display components (the overall readiness score in `ScoreGauge`, and the archetype sub-scores) that sets `background: var(--score-fill-gradient); -webkit-background-clip: text; background-clip: text; color: transparent;` under `:root[data-tier="premium"] <selector>`, leaving the free-tier rule (`color: var(--ink)`) untouched otherwise. The plan must identify the exact score-number selectors in `components/ScoreGauge.tsx` and `components/AthleteArchetypeCard.tsx` during implementation — scope this to primary numeric score displays only, not every number in the UI (e.g. not run-split times, not station counts).

**Explicitly out of scope for this pass:** a global corner radial-glow effect (shown in one brainstorm mockup) is NOT part of this spec — applying a decorative `::after` glow consistently across every page/card container app-wide is a much larger surface than the token-driven changes above and isn't needed to deliver "premium feels richer." Can be proposed as a follow-up once the core tier system ships.

## Testing

`lib/preferences.test.ts` already stubs `window` (localStorage + matchMedia) to test theme persistence with no jsdom — the same pattern can verify `PremiumTierGate` sets `dataset.tier` correctly given a mocked `fetch` response, without needing jsdom or React Testing Library (consistent with this codebase's established "no component tests" posture — see `docs/superpowers/specs/` prior design notes). Contrast ratios are a one-time calculation already verified in this design doc; no runtime contrast-checking code is being added (this is a design-time concern, not a feature to build).

## Follow-ups (not blocking this spec)

- Premium Light's exact "richer panel" gradient values were chosen for a subtle warm-paper effect and should be eyeballed against real content during implementation — the brainstorm mockup only showed Premium Dark and Free Light in detail, not Premium Light itself.
- The global corner-glow effect, if wanted later, is a separate follow-up spec.
