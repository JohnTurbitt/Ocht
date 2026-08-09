# Account Settings Modal Design

**Date:** 2026-06-16
**Status:** Approved for implementation

---

## Goal

Replace the current `AuthPanel` account dropdown (which mixes profile editing, avatar customisation, billing, data export, and account deletion in a single scrollable menu) with a tabbed settings modal. Dangerous actions (data export, account deletion) move to a dedicated Privacy tab that users must navigate to deliberately.

---

## What changes

- **`components/AuthPanel.tsx`** — stripped back to: trigger button, guest-state dropdown, and auth form popover. All logged-in account management moves out.
- **`components/SettingsModal.tsx`** (new) — the modal component with 4 tabs, header, and footer.
- **`styles/_auth.scss`** — new modal/tab styles added; old account-menu styles removed.

## What does NOT change

- Auth forms (login, signup, forgot password flow) — untouched.
- Guest-state dropdown (theme/distance quick settings + login/join buttons) — untouched.
- All API routes (`/api/auth/me`, `/api/auth/me/export`) — untouched.
- `lib/apiClient.ts`, `lib/cookieConsent.ts`, `app/page.tsx` handler functions — untouched.

---

## Trigger behaviour

**Guest users:** clicking the avatar trigger continues to open the existing lightweight dropdown (theme/distance toggles + login/join buttons). No change.

**Logged-in users:** clicking the avatar trigger opens `SettingsModal`. The current account dropdown no longer renders for logged-in users.

---

## SettingsModal component

### Props

```ts
type SettingsModalProps = {
  user: AuthUser;
  loading: boolean;
  billingLoading: boolean;
  distanceUnit: DistanceUnit;
  onDistanceUnitChange: (unit: DistanceUnit) => void;
  avatarColor: string;
  onAvatarColorChange: (color: string) => void;
  avatarIcon: string;
  onAvatarIconChange: (icon: string) => void;
  onLogout: () => Promise<void>;
  onStartCheckout: () => void;
  onManageBilling: () => void;
  onResendVerification: () => Promise<void>;
  onSaveProfile: (input: ProfileFormInput) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onClose: () => void;
};
```

### State

| State | Type | Purpose |
|---|---|---|
| `activeTab` | `"profile" \| "appearance" \| "billing" \| "privacy"` | Which tab is visible |
| `profileName` | `string` | Controlled input for name field |
| `profileLevel` | `Level` | Controlled input for default level |
| `profileTargetTime` | `string` | Controlled input for target time |
| `submitting` | `boolean` | Profile save in-flight |
| `deleteConfirmOpen` | `boolean` | Whether the delete confirm card is showing |
| `deleting` | `boolean` | Account deletion in-flight |

### Overlay and dismissal

- Modal renders as a fixed full-viewport overlay (`position: fixed; inset: 0`) with a semi-transparent dark backdrop (`background: rgba(0,0,0,0.6)`).
- The modal card has `max-width: 580px`, is horizontally centred, and sits `10vh` from the top on desktop. On mobile it is full-width with no top offset (full-height scroll if needed).
- Clicking the backdrop closes the modal (calls `onClose`).
- Pressing `Escape` closes the modal.
- Focus is trapped inside the modal while open. Use a `keydown` listener on the overlay to keep Tab/Shift+Tab within the modal's focusable elements.
- The modal is conditionally rendered (`{settingsOpen && <SettingsModal … />}` in `AuthPanel`), so all internal state resets automatically on close. `onClose` only needs to set `settingsOpen` to `false` in the parent.

---

## Modal structure

### Header (always visible)

Shows the user's avatar, display name, email, and subscription label. Close button (×) top-right.

```
[ Avatar ]  John Turbitt                          ×
            john@example.com · Free account
```

### Tab bar

Four tabs in order: **Profile · Appearance · Billing · Privacy**

- Active tab: lime underline (`#c8ff2e`), white text.
- Privacy tab text: muted red (`#e07070`) in all states to signal its nature without being alarming.
- Tab switching is instant; no route changes.

### Footer (always visible)

Single "Log out" button, right-aligned, in the secondary button style.

---

## Tab content

### Profile tab

Fields:
- **Name** — editable text input, pre-populated from `user.name`.
- **Email** — read-only input showing `user.email`, with a "Verified" / "Unverified" badge.
- **Default level** — select, options from `levelLabels`.
- **Default target time** — text input, `inputMode="numeric"`.
- **Avatar** — icon picker row + colour swatch row (moved from the old dropdown).

If email is unverified, show the resend-verification prompt inline below the email field.

Save action: "Save profile" primary button. On success, stays on the Profile tab (modal does not close).

### Appearance tab

Two toggle groups reusing the existing `account-settings__switch` pattern:
- **Theme** — Light / Dark
- **Distance** — KM / Miles

Changes apply immediately. No save button.

### Billing tab

Shows subscription status and the relevant action:

| Subscription state | Content |
|---|---|
| `FREE` | Status label + "Upgrade to premium" button |
| `CANCELED` | Status label + "Upgrade to premium" button |
| `ACTIVE` | "Premium" badge + "Manage billing" button |
| `PAST_DUE` | "Payment past due" warning + "Manage billing" button |

Billing/checkout actions call `onClose()` before opening the Stripe redirect.

### Privacy tab

Two sections separated by a divider:

**Your data**
- Body: "Download a copy of your account and all saved reports as JSON."
- "↓ Download my data" link pointing to `/api/auth/me/export`.

**Danger zone** (red-tinted section label + bordered card)
- Heading: "Delete account"
- Body: "Permanently deletes your account, all reports, and cancels your subscription. This cannot be undone."
- Default state: "Delete account" button (red outline).
- After clicking, `deleteConfirmOpen` becomes `true` and the button is replaced by:
  - Warning card: "Are you sure? We recommend downloading your data first."
  - Two buttons: "Cancel" (secondary) | "Yes, delete" (red fill).
  - "Cancel" resets `deleteConfirmOpen` to `false`.
  - "Yes, delete" calls `onDeleteAccount()`, shows spinner while `deleting` is `true`.
  - On success, `onClose()` is called (modal closes, user is signed out by the existing handler in `app/page.tsx`).

---

## Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-label="Account settings"` on the modal element.
- Focus moves to the modal's first focusable element on open; returns to the avatar trigger on close.
- Tab bar uses `role="tab"` / `aria-selected`; panels use `role="tabpanel"`.
- "Yes, delete" button has `aria-label="Permanently delete my account"`.

---

## CSS

New classes in `styles/_auth.scss`:
- `.settings-modal-overlay` — fixed backdrop
- `.settings-modal` — modal card
- `.settings-modal__header` — account summary row
- `.settings-modal__tabs` — tab bar
- `.settings-modal__tab` / `--active` / `--danger` modifiers
- `.settings-modal__panel` — tab content area
- `.settings-modal__footer` — log out row
- `.settings-modal__danger-zone` — red-bordered card
- `.settings-modal__delete-confirm` — confirm card inside danger zone

Old classes removed: `.auth-panel__account-menu`, `.auth-panel__delete-confirm`, `.auth-panel__delete-confirm-actions`, `.auth-panel__menu-item`, `.auth-panel__menu-item--danger`, `.auth-panel__upgrade`, `.auth-panel__defaults`, `.auth-panel__verify`.

---

## Testing

No new automated tests. `SettingsModal` is a UI component; its underlying API routes and handlers are already tested. Manual verification covers:

1. Logged-in: clicking avatar opens modal; Escape / backdrop click closes it.
2. All 4 tabs render correct content.
3. Profile save updates name/level/time; avatar and colour changes apply immediately.
4. Appearance changes (theme/distance) apply immediately.
5. Billing tab shows correct state per subscription and opens Stripe on click.
6. Privacy tab: "Download my data" triggers download; delete confirm flow works (open → cancel → open → confirm); modal closes and user is signed out after deletion.
7. Guest: avatar trigger still opens old dropdown, not the modal.
