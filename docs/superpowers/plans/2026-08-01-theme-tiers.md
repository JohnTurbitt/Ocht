# Light-Mode Accent + Premium Visual Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix light mode's washed-out lime accent by giving it its own teal identity, and add a premium visual tier (richer panels/buttons/glows) that layers onto whichever theme a subscriber is using.

**Architecture:** `--lime` is redefined per-theme in `styles/_base.scss` (dark keeps `#c8ff2e`, light becomes `#0b5e4c` deep teal) rather than introducing a new token and migrating call sites — see the deviation note below. A new `data-tier` attribute (set by a new `components/PremiumTierGate.tsx`, mirroring the existing `components/OnboardingGate.tsx`) sits alongside the existing `data-theme` attribute on `<html>`, and drives new `[data-theme="X"][data-tier="premium"]` CSS blocks that override `--panel`, `--surface`, `--action-bg`, and two new glow-shadow tokens. A small number of existing rules (`.btn--primary`, two accent-bar rules, one score-number rule) get one-line additions to actually render the new glow/gradient tokens.

**Tech Stack:** Next.js 15, TypeScript, Sass, Vitest (node environment, no jsdom).

**Deviation from the approved spec (`docs/superpowers/specs/2026-08-01-theme-tiers-design.md`), found during planning:**

The spec proposed a new `--accent-ink` token and migrating every TEXT-role `var(--lime)` usage to it. Grepping the codebase during planning found **~90 occurrences of `var(--lime)` across 11 stylesheet files** (`_auth`, `_layout`, `_forms`, `_landing`, `_events`, `_simulator`, `_history`, `_share`, `_loader`, `_settings`, `_report`) — far larger than "a small enumerable set," and hand-classifying each as text-vs-background would be slow and error-prone (many are small decorative elements — dots, pulse-dots, SVG gauge fills — that have the exact same light-mode legibility problem as text, not a clean binary).

Crucially, `.btn--primary` (`styles/_buttons.scss:99-103`) uses `background: var(--action-bg)`, a **separate** token from `--lime` — buttons never reference `--lime` directly. That means **every single one of the ~90 usages is already the "accent" category the user complained about**, not a button background. So instead of introducing a new token, this plan redefines `--lime` itself in the light theme's root block. This fixes all ~90 usages automatically with a one-line change, can't miss a spot, and matches an intent already half-present in the codebase — `styles/_base.scss` already has a comment on the existing `--accent: var(--teal)` mapping: *"brand lime washes out on light surfaces... lime is for fills (CTA), not accents."* Buttons are entirely unaffected since they use `--action-bg`, not `--lime`.

The spec's `--score-fill-gradient` gradient-text treatment assumed `background-clip: text` works uniformly for "score numbers." Planning found the overall readiness score (`components/ScoreGauge.tsx`) renders as **SVG `<text>`** (styled via `fill: var(--lime)` in `_report.scss:3125`), where `background-clip: text` does not apply — SVG text needs a `<linearGradient>` def and `fill="url(#id)"` instead, a meaningfully different (and more involved) technique. To keep this plan achievable, **gradient-text premium treatment in this pass is scoped to the archetype sub-scores only** (`components/AthleteArchetypeCard.tsx`, which renders scores as plain HTML `<strong>` text, not SVG) — `ScoreGauge`'s SVG score number is called out as a follow-up, not built here.

The spec's global corner-glow effect was already explicitly out of scope in the spec itself — unchanged here.

---

### Task 1: Light-mode accent — redefine `--lime` for light theme

**Files:**
- Modify: `styles/_base.scss:14`

- [ ] **Step 1: Change the light theme's lime value**

In `styles/_base.scss`, the light theme's root block currently has (line 14):
```scss
  --lime: #c8ff2e;
```
Change it to:
```scss
  /* Deep teal, not lime — lime as a raw accent/text/fill color washes out on
     light backgrounds (~1.14:1 contrast, fails WCAG). Buttons are unaffected:
     they use --action-bg, a separate token, still lime in both themes. */
  --lime: #0b5e4c;
```
Leave the dark theme's `--lime: #c8ff2e;` (currently line 61) untouched.

- [ ] **Step 2: Verify contrast and unrelated tokens**

Run: `grep -n "^\s*--lime:\|^\s*--action-bg:" styles/_base.scss`
Expected output shows exactly two `--lime:` lines (light `#0b5e4c`, dark `#c8ff2e`) and two `--action-bg:` lines (both still `#c8ff2e`) — confirming buttons didn't change.

- [ ] **Step 3: Build check**

Run: `npm run lint`
Expected: no errors (pre-existing warnings in `app/app/page.tsx`/`components/AuthPanel.tsx` are fine, unrelated).

Run: `npm run build`
Expected: build succeeds (Sass compiles the changed value with no syntax impact — this is a plain value change, not a structural one).

- [ ] **Step 4: Commit**

```bash
git add styles/_base.scss
git commit -m "fix: light mode uses deep teal instead of lime for accents/text/fills"
```

---

### Task 2: Premium tier gating component

**Files:**
- Create: `components/PremiumTierGate.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the gate component**

Create `components/PremiumTierGate.tsx`, mirroring `components/OnboardingGate.tsx`'s exact pattern (fetch `/api/auth/me` on mount, no props, renders nothing):

```tsx
"use client";

import { useEffect } from "react";

export function PremiumTierGate() {
  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        document.documentElement.dataset.tier =
          data.user?.subscription === "ACTIVE" ? "premium" : "free";
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
```

- [ ] **Step 2: Wire it into the root layout**

In `app/layout.tsx`, add the import alongside the existing component imports:
```tsx
import { PremiumTierGate } from "@/components/PremiumTierGate";
```
And render it in the body alongside the existing `<OnboardingGate />` (find this block near the end of the `<body>`):
```tsx
        {children}
        <OnboardingGate />
        <PremiumTierGate />
        <SiteFooter />
        <CookieBanner />
        <ConsentedAnalytics />
```

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect no errors.
Run: `npm run build` — expect success.

No automated test for this component — it has no pure logic to extract (it's a DOM side-effect from a fetch result), matching the existing untested `OnboardingGate` precedent exactly (confirmed: no `OnboardingGate.test.tsx` exists in this codebase). Manual verification happens in Task 6.

- [ ] **Step 4: Commit**

```bash
git add components/PremiumTierGate.tsx app/layout.tsx
git commit -m "feat: add premium tier gate — sets data-tier from subscription status"
```

---

### Task 3: Premium CSS tokens

**Files:**
- Modify: `styles/_base.scss`

- [ ] **Step 1: Add baseline (free-tier) glow tokens to both existing root blocks**

In the light theme's `:root { ... }` block (after the line `--flow-lost: rgba(13, 20, 15, 0.12);`, just before the closing `}`), add:
```scss
  --accent-glow: 0 0 0 transparent;
  --action-glow: 0 0 0 transparent;
```
In the dark theme's `[data-theme="dark"] { ... }` block (after the line `--flow-lost: rgba(244, 247, 239, 0.14);`, just before `color-scheme: dark;`), add the same two lines:
```scss
  --accent-glow: 0 0 0 transparent;
  --action-glow: 0 0 0 transparent;
```
These are inert (zero-size, transparent) shadows so they can always be safely appended to an existing `box-shadow` list without ever producing invalid CSS — premium overrides below replace them with real glow values.

- [ ] **Step 2: Add the two premium override blocks**

Immediately after the closing `}` of the `[data-theme="dark"] { ... }` block (before `* { box-sizing: border-box; }`), add:

```scss
[data-theme="dark"][data-tier="premium"] {
  --panel: linear-gradient(155deg, #101c16 0%, #0a1310 60%, #0e1914 100%);
  --surface: linear-gradient(155deg, #182922 0%, #101c16 60%, #14241d 100%);
  --action-bg: linear-gradient(135deg, #d6ff5e, #a8e600);
  --accent-glow: 0 0 12px rgba(200, 255, 46, 0.55);
  --action-glow: 0 4px 14px rgba(200, 255, 46, 0.35);
  --score-fill-gradient: linear-gradient(180deg, #fbffe8, #c8ff2e);
}

[data-theme="light"][data-tier="premium"] {
  --panel: linear-gradient(155deg, #ffffff 0%, #eef3e6 55%, #fafcf6 100%);
  --surface: linear-gradient(155deg, #f4f8ee 0%, #e9eee1 60%, #e3ebda 100%);
  --action-bg: linear-gradient(135deg, #d6ff5e, #a8e600);
  --accent-glow: 0 0 12px rgba(11, 94, 76, 0.35);
  --action-glow: 0 4px 14px rgba(200, 255, 46, 0.35);
  --score-fill-gradient: linear-gradient(180deg, #14806a, #0b5e4c);
}
```

Both selectors have specificity `(0,0,2,0)` (two attribute selectors), which is higher than the plain `[data-theme="dark"]` / base `:root` rules `(0,0,1,0)`, so they correctly override regardless of source order — verified by reasoning about CSS specificity rules, no runtime check needed for this alone (verified functionally in Task 6).

- [ ] **Step 3: Verify**

Run: `npm run lint` — expect no errors.
Run: `npm run build` — expect success (valid Sass/CSS, no nesting used here so no Sass-specific syntax risk).

- [ ] **Step 4: Commit**

```bash
git add styles/_base.scss
git commit -m "feat: add premium tier CSS tokens (panel/surface/button gradients, glow shadows)"
```

---

### Task 4: Wire glow tokens into existing accent elements

**Files:**
- Modify: `styles/_buttons.scss:99-103`
- Modify: `styles/_report.scss:62-70`
- Modify: `styles/_landing.scss` (the `.landing-feature__preview::before` rule)

- [ ] **Step 1: Add the button glow**

In `styles/_buttons.scss`, `.btn--primary` currently reads:
```scss
.btn--primary {
  border-color: var(--action-bg);
  background: var(--action-bg);
  color: var(--action-text);
}
```
Add a `box-shadow` line:
```scss
.btn--primary {
  border-color: var(--action-bg);
  background: var(--action-bg);
  color: var(--action-text);
  box-shadow: var(--action-glow);
}
```

- [ ] **Step 2: Add the report card accent-bar glow**

In `styles/_report.scss`, `.results-reveal__card::before` currently reads (lines 62-70):
```scss
.results-reveal__card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--lime);
}
```
Add a `box-shadow` line:
```scss
.results-reveal__card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--lime);
  box-shadow: var(--accent-glow);
}
```

- [ ] **Step 3: Add the landing feature-preview accent-bar glow**

In `styles/_landing.scss`, find the `.landing-feature__preview::before` rule (added in a prior plan's Task 4 — it sets `background: var(--lime)` as a 2px top bar) and add the same `box-shadow: var(--accent-glow);` line to it, following the exact same pattern as Step 2.

- [ ] **Step 4: Verify**

Run: `npm run lint` — expect no errors.
Run: `npm run build` — expect success.

- [ ] **Step 5: Commit**

```bash
git add styles/_buttons.scss styles/_report.scss styles/_landing.scss
git commit -m "feat: render the premium glow tokens on buttons and accent bars"
```

---

### Task 5: Premium gradient-text score treatment (archetype scores)

**Files:**
- Modify: `styles/_report.scss` (new rule, no existing rule to edit)

- [ ] **Step 1: Add the premium override rule**

`components/AthleteArchetypeCard.tsx` renders each score as:
```tsx
<div className="archetype-score__head">
  <span>{label}</span>
  <strong>
    <CountUp value={score} />
  </strong>
</div>
```
No JSX change is needed — add a new CSS rule to `styles/_report.scss` (anywhere near the other `.archetype-score*` rules, or at the end of the file) that only takes effect under the premium selector:
```scss
[data-tier="premium"] .archetype-score__head strong {
  background: var(--score-fill-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```
This has no effect at all in the free tier (`--score-fill-gradient` is never defined outside the two premium blocks from Task 3, so this rule's `background` property would be invalid and ignored when the attribute selector doesn't even match — the whole rule simply doesn't apply when `[data-tier="premium"]` isn't present on `<html>`, regardless of variable definition).

- [ ] **Step 2: Verify**

Run: `npm run lint` — expect no errors.
Run: `npm run build` — expect success.

- [ ] **Step 3: Commit**

```bash
git add styles/_report.scss
git commit -m "feat: gradient-text treatment for archetype scores under premium tier"
```

---

### Task 6: Manual verification

No new automated tests — this codebase doesn't unit-test presentational/CSS/DOM-side-effect components (see `lib/preferences.test.ts` for where the real logic coverage lives: pure localStorage read/write, not `applyTheme`'s DOM manipulation). This task is the visual/behavioral check across all 4 theme×tier combinations.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://127.0.0.1:3002`.

- [ ] **Step 2: Check light mode's new accent (logged out, free tier)**

Visit `http://127.0.0.1:3002/app`, switch to light theme via the account menu, load the sample race report.
Expected: eyebrows/kickers/badges/leak-vs-strong indicators that were lime now render in deep teal (`#0b5e4c`) and are clearly legible against the light panel/paper backgrounds. Primary buttons ("Build my report" etc.) are still lime with dark text, unchanged.

- [ ] **Step 3: Check dark mode is unaffected**

Switch to dark theme.
Expected: everything looks exactly as it did before this plan — lime accents, lime buttons, no visual change (dark theme's `--lime` value didn't change).

- [ ] **Step 4: Check premium tier — dark**

Sign in with an account that has `subscription: "ACTIVE"` (or manually set one via Prisma Studio / the dev seed script if none exists), confirm `document.documentElement.dataset.tier === "premium"` via browser devtools, in dark theme.
Expected: report panels show a subtle diagonal gradient background instead of flat color; primary buttons show a lime gradient with a soft glow shadow; the results-reveal card's top accent bar and landing feature-preview's top bar both show a lime glow; archetype score numbers render as a lime gradient fill instead of solid color.

- [ ] **Step 5: Check premium tier — light**

Switch to light theme while still signed in as the premium account.
Expected: same richer treatment, but glows/gradients use teal instead of lime (accent-bar glow, archetype score gradient); buttons still use the lime gradient (buttons stay lime in both themes per the approved design).

- [ ] **Step 6: Check a free (non-premium) signed-in account still looks like free tier**

Sign in with (or confirm) a non-premium account.
Expected: `data-tier` is `"free"`, and the app looks identical to Steps 2/3 — no premium gradients/glows leak in for non-subscribers.

- [ ] **Step 7: Final full verification**

Run: `npm run test`
Run: `npm run lint`
Run: `npm run build`
Expected: all green (aside from the pre-existing, unrelated `lib/analysis.test.ts` archetype-id failures already present on this branch before this plan, confirmed unrelated in the prior landing-page plan's every task review).

No commit for this task — it's verification only. If any step surfaces a bug, fix it in the relevant earlier task's files and commit the fix with a `fix:` message before continuing.
