# Account Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the logged-in account dropdown in `AuthPanel` with a tabbed settings modal (`SettingsModal`) that puts dangerous actions (data export, account deletion) in a dedicated Privacy tab.

**Architecture:** A new `components/SettingsModal.tsx` handles all logged-in account management across four tabs (Profile, Appearance, Billing, Privacy). `AuthPanel` is stripped back to the trigger button, guest dropdown, and auth form popover — it conditionally renders `SettingsModal` via a `settingsOpen` boolean. No changes to `app/page.tsx`, API routes, or handler functions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, SCSS.

**Spec:** `docs/superpowers/specs/2026-06-16-account-settings-modal-design.md`

---

## File map

| Action | File | What changes |
|--------|------|--------------|
| Create | `components/SettingsModal.tsx` | New 4-tab modal component |
| Modify | `components/AuthPanel.tsx` | Strip logged-in dropdown; add `settingsOpen` state; render `SettingsModal` |
| Modify | `styles/_auth.scss` | Add `.settings-modal-*` CSS; remove old dropdown classes |

---

### Task 1: Add settings modal CSS to `styles/_auth.scss`

**Files:**
- Modify: `styles/_auth.scss` (append after the last line — currently the `.auth-panel__delete-confirm-actions button` rule)

- [ ] **Step 1: Append the new settings modal CSS**

Open `styles/_auth.scss` and add the following block at the very end of the file:

```scss

/* ─── Settings modal ─────────────────────────────────── */

.settings-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 10vh 16px 24px;
  overflow-y: auto;
}

.settings-modal {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.settings-modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--line);
}

.settings-modal__header-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.settings-modal__header-info strong {
  font-size: 0.95rem;
  color: var(--ink);
  font-weight: 700;
}

.settings-modal__header-info span {
  font-size: 0.78rem;
  color: var(--teal);
}

.settings-modal__close {
  background: none;
  border: none;
  color: var(--teal);
  font-size: 1.4rem;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  border-radius: 6px;
}

.settings-modal__close:hover {
  background: var(--line);
}

.settings-modal__tabs {
  display: flex;
  border-bottom: 1px solid var(--line);
  padding: 0 8px;
}

.settings-modal__tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 12px 16px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--teal);
  cursor: pointer;
  white-space: nowrap;
}

.settings-modal__tab--active {
  color: var(--ink);
  border-bottom-color: var(--green);
}

.settings-modal__tab--danger {
  color: var(--red);
}

.settings-modal__tab--danger.settings-modal__tab--active {
  color: var(--red);
  border-bottom-color: var(--red);
}

.settings-modal__panel {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.settings-modal__footer {
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
}

.settings-modal__form {
  display: grid;
  gap: 14px;
}

.settings-modal__form-actions {
  display: flex;
  justify-content: flex-start;
}

.settings-modal__email-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-modal__email-row input {
  flex: 1;
}

.settings-modal__badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.settings-modal__badge--verified {
  background: rgba(200, 255, 46, 0.15);
  color: var(--green);
}

.settings-modal__badge--unverified {
  background: var(--error-soft);
  color: var(--red);
}

.settings-modal__verify {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--teal);
}

.settings-modal__verify p {
  margin: 0;
}

.settings-modal__billing {
  display: grid;
  gap: 12px;
}

.settings-modal__billing-status {
  color: var(--ink);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.settings-modal__billing-warning {
  display: block;
  font-size: 0.82rem;
  color: var(--red);
  margin-top: 4px;
  width: 100%;
}

.settings-modal__privacy {
  display: grid;
  gap: 20px;
}

.settings-modal__section h3 {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 6px;
}

.settings-modal__section p {
  font-size: 0.82rem;
  color: var(--teal);
  margin: 0 0 12px;
}

.settings-modal__divider {
  border: none;
  border-top: 1px solid var(--line);
  margin: 0;
}

.settings-modal__danger-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--red);
  margin: 0 0 10px;
}

.settings-modal__danger-zone {
  border: 1px solid var(--red);
  border-radius: 10px;
  padding: 14px;
  background: var(--error-soft);
  display: grid;
  gap: 8px;
}

.settings-modal__danger-zone strong {
  font-size: 0.88rem;
  color: var(--ink);
}

.settings-modal__danger-zone > p {
  font-size: 0.82rem;
  color: var(--teal);
  margin: 0;
}

.settings-modal__delete-confirm {
  background: var(--panel);
  border: 1px solid var(--red);
  border-radius: 8px;
  padding: 10px 12px;
  display: grid;
  gap: 10px;
}

.settings-modal__delete-confirm > p {
  font-size: 0.82rem;
  color: var(--red);
  font-weight: 600;
  margin: 0;
}

.settings-modal__delete-confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.settings-modal__delete-btn {
  background: var(--red);
  border: 1px solid var(--red);
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  width: 100%;
  min-height: 40px;
}

.settings-modal__delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settings-modal__delete-btn--outline {
  background: none;
  color: var(--red);
}

.settings-modal__delete-btn--outline:hover:not(:disabled) {
  background: var(--red);
  color: #fff;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/_auth.scss
git commit -m "Add settings modal CSS to _auth.scss"
```

---

### Task 2: Create `components/SettingsModal.tsx`

**Files:**
- Create: `components/SettingsModal.tsx`

- [ ] **Step 1: Create the component**

Create `components/SettingsModal.tsx`:

```tsx
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Level, levelLabels } from "@/lib/analysis";
import { AuthUser, ProfileFormInput } from "@/lib/apiClient";
import { AVATAR_ICONS, AvatarMark } from "./AvatarMark";
import { avatarColors, Theme } from "@/lib/preferences";
import type { DistanceUnit } from "@/lib/units";
import { OctagonSpinner } from "./OctagonSpinner";
import { PremiumBadge } from "./PremiumBadge";

type Tab = "profile" | "appearance" | "billing" | "privacy";

const subscriptionLabels: Record<AuthUser["subscription"], string> = {
  ACTIVE: "Premium",
  CANCELED: "Subscription canceled",
  FREE: "Free account",
  PAST_DUE: "Payment past due",
};

type SettingsModalProps = {
  user: AuthUser;
  theme: Theme;
  loading: boolean;
  billingLoading: boolean;
  distanceUnit: DistanceUnit;
  onDistanceUnitChange: (unit: DistanceUnit) => void;
  avatarColor: string;
  onAvatarColorChange: (color: string) => void;
  avatarIcon: string;
  onAvatarIconChange: (icon: string) => void;
  onThemeChange: (theme: Theme) => void;
  onLogout: () => Promise<void>;
  onStartCheckout: () => void;
  onManageBilling: () => void;
  onResendVerification: () => Promise<void>;
  onSaveProfile: (input: ProfileFormInput) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onClose: () => void;
};

export function SettingsModal({
  user,
  theme,
  loading,
  billingLoading,
  distanceUnit,
  onDistanceUnitChange,
  avatarColor,
  onAvatarColorChange,
  avatarIcon,
  onAvatarIconChange,
  onThemeChange,
  onLogout,
  onStartCheckout,
  onManageBilling,
  onResendVerification,
  onSaveProfile,
  onDeleteAccount,
  onClose,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profileName, setProfileName] = useState(user.name ?? "");
  const [profileLevel, setProfileLevel] = useState<Level>(user.defaultLevel);
  const [profileTargetTime, setProfileTargetTime] = useState(
    user.defaultTargetTime,
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isPremium = user.subscription === "ACTIVE";
  const canManageBilling =
    user.subscription === "ACTIVE" || user.subscription === "PAST_DUE";
  const canUpgrade =
    user.subscription === "FREE" || user.subscription === "CANCELED";
  const displayName = user.name || user.email || "";
  const userInitial = displayName.trim().charAt(0).toUpperCase() || "O";

  useEffect(() => {
    const modal = modalRef.current;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !modal) return;

      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    modal
      ?.querySelector<HTMLElement>("button, [href], input, select")
      ?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSaveProfile({
        name: profileName,
        defaultLevel: profileLevel,
        defaultTargetTime: profileTargetTime,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setDeleteConfirmOpen(false);
  }

  return (
    <div
      className="settings-modal-overlay"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Account settings"
      >
        {/* Header */}
        <div className="settings-modal__header">
          <span
            className={
              isPremium
                ? "auth-panel__avatar auth-panel__avatar--premium"
                : "auth-panel__avatar"
            }
            style={{ background: avatarColor }}
            aria-hidden="true"
          >
            <AvatarMark icon={avatarIcon} initial={userInitial} />
          </span>
          <div className="settings-modal__header-info">
            <strong>{displayName}</strong>
            <span>
              {user.email} · {subscriptionLabels[user.subscription]}
            </span>
          </div>
          <button
            type="button"
            className="settings-modal__close"
            onClick={onClose}
            aria-label="Close account settings"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="settings-modal__tabs" role="tablist">
          {(["profile", "appearance", "billing", "privacy"] as Tab[]).map(
            (tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                type="button"
                className={[
                  "settings-modal__tab",
                  activeTab === tab ? "settings-modal__tab--active" : "",
                  tab === "privacy" ? "settings-modal__tab--danger" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => switchTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ),
          )}
        </div>

        {/* Panel */}
        <div className="settings-modal__panel" role="tabpanel">

          {/* Profile tab */}
          {activeTab === "profile" && (
            <form
              onSubmit={handleSaveProfile}
              className="settings-modal__form"
            >
              <label className="field">
                <span>Name</span>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Runner name"
                />
              </label>
              <label className="field">
                <span>Email</span>
                <div className="settings-modal__email-row">
                  <input value={user.email} readOnly aria-readonly="true" />
                  <span
                    className={
                      user.emailVerified
                        ? "settings-modal__badge settings-modal__badge--verified"
                        : "settings-modal__badge settings-modal__badge--unverified"
                    }
                  >
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </label>
              {!user.emailVerified && (
                <div className="settings-modal__verify">
                  <p>Verify your email to keep account recovery reliable.</p>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => void onResendVerification()}
                    disabled={loading || submitting}
                  >
                    Resend verification email
                  </button>
                </div>
              )}
              <label className="field">
                <span>Default athlete level</span>
                <select
                  value={profileLevel}
                  onChange={(e) =>
                    setProfileLevel(e.target.value as Level)
                  }
                >
                  {Object.entries(levelLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Default target time</span>
                <input
                  value={profileTargetTime}
                  onChange={(e) => setProfileTargetTime(e.target.value)}
                  inputMode="numeric"
                  placeholder="1:25:00"
                />
              </label>
              <div className="account-settings avatar-picker">
                <span className="account-settings__label">Avatar</span>
                <div className="avatar-icons">
                  {AVATAR_ICONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={
                        option.id === avatarIcon
                          ? "avatar-icon is-active"
                          : "avatar-icon"
                      }
                      onClick={() => onAvatarIconChange(option.id)}
                      aria-label={`${option.label} avatar`}
                      aria-pressed={option.id === avatarIcon}
                    >
                      <AvatarMark icon={option.id} initial={userInitial} />
                    </button>
                  ))}
                </div>
                <div className="avatar-swatches">
                  {avatarColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        color === avatarColor
                          ? "avatar-swatch is-active"
                          : "avatar-swatch"
                      }
                      style={{ background: color }}
                      onClick={() => onAvatarColorChange(color)}
                      aria-label={`Use ${color} avatar colour`}
                      aria-pressed={color === avatarColor}
                    />
                  ))}
                </div>
              </div>
              <div className="settings-modal__form-actions">
                <button type="submit" disabled={submitting || loading}>
                  {submitting ? (
                    <span className="button-loading">
                      <OctagonSpinner size={16} />
                      Saving...
                    </span>
                  ) : (
                    "Save profile"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Appearance tab */}
          {activeTab === "appearance" && (
            <div className="account-settings">
              <div className="account-settings__group">
                <span className="account-settings__label">Theme</span>
                <div className="account-settings__switch">
                  <button
                    type="button"
                    className={theme === "light" ? "is-active" : undefined}
                    onClick={() => onThemeChange("light")}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={theme === "dark" ? "is-active" : undefined}
                    onClick={() => onThemeChange("dark")}
                  >
                    Dark
                  </button>
                </div>
              </div>
              <div className="account-settings__group">
                <span className="account-settings__label">Distance</span>
                <div className="account-settings__switch">
                  <button
                    type="button"
                    className={
                      distanceUnit === "km" ? "is-active" : undefined
                    }
                    onClick={() => onDistanceUnitChange("km")}
                  >
                    KM
                  </button>
                  <button
                    type="button"
                    className={
                      distanceUnit === "mi" ? "is-active" : undefined
                    }
                    onClick={() => onDistanceUnitChange("mi")}
                  >
                    Miles
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Billing tab */}
          {activeTab === "billing" && (
            <div className="settings-modal__billing">
              <p className="settings-modal__billing-status">
                {subscriptionLabels[user.subscription]}
                {isPremium ? (
                  <>
                    {" "}
                    <PremiumBadge />
                  </>
                ) : null}
                {user.subscription === "PAST_DUE" ? (
                  <span className="settings-modal__billing-warning">
                    Payment past due — please update your billing details.
                  </span>
                ) : null}
              </p>
              {canUpgrade ? (
                <button
                  className="button-secondary auth-panel__upgrade"
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartCheckout();
                  }}
                  disabled={loading || billingLoading}
                >
                  {billingLoading ? (
                    <span className="button-loading">
                      <OctagonSpinner size={16} />
                      Opening...
                    </span>
                  ) : (
                    "Upgrade to premium"
                  )}
                </button>
              ) : null}
              {canManageBilling ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    onClose();
                    onManageBilling();
                  }}
                  disabled={loading || billingLoading}
                >
                  {billingLoading ? (
                    <span className="button-loading">
                      <OctagonSpinner size={16} />
                      Opening...
                    </span>
                  ) : (
                    "Manage billing"
                  )}
                </button>
              ) : null}
            </div>
          )}

          {/* Privacy tab */}
          {activeTab === "privacy" && (
            <div className="settings-modal__privacy">
              <div className="settings-modal__section">
                <h3>Your data</h3>
                <p>
                  Download a copy of your account and all saved reports as
                  JSON.
                </p>
                <a className="button-secondary" href="/api/auth/me/export">
                  ↓ Download my data
                </a>
              </div>

              <hr className="settings-modal__divider" />

              <div className="settings-modal__section">
                <p className="settings-modal__danger-label">Danger zone</p>
                <div className="settings-modal__danger-zone">
                  <strong>Delete account</strong>
                  <p>
                    Permanently deletes your account, all reports, and cancels
                    your subscription. This cannot be undone.
                  </p>
                  {deleteConfirmOpen ? (
                    <div className="settings-modal__delete-confirm">
                      <p>
                        Are you sure? We recommend downloading your data
                        first.
                      </p>
                      <div className="settings-modal__delete-confirm-actions">
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => setDeleteConfirmOpen(false)}
                          disabled={deleting}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="settings-modal__delete-btn"
                          aria-label="Permanently delete my account"
                          onClick={async () => {
                            setDeleting(true);
                            try {
                              await onDeleteAccount();
                              onClose();
                            } finally {
                              setDeleting(false);
                            }
                          }}
                          disabled={deleting}
                        >
                          {deleting ? (
                            <span className="button-loading">
                              <OctagonSpinner size={16} />
                              Deleting...
                            </span>
                          ) : (
                            "Yes, delete"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="settings-modal__delete-btn settings-modal__delete-btn--outline"
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={loading}
                    >
                      Delete account
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="settings-modal__footer">
          <button
            className="button-secondary"
            type="button"
            onClick={() => void onLogout()}
            disabled={loading}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in `components/SettingsModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/SettingsModal.tsx
git commit -m "Add SettingsModal component with 4-tab account settings"
```

---

### Task 3: Refactor `components/AuthPanel.tsx`

**Files:**
- Modify: `components/AuthPanel.tsx`

The logged-in branch is replaced entirely. The guest branch and auth form popover are untouched.

- [ ] **Step 1: Replace the import block**

The current imports at the top of `components/AuthPanel.tsx` are:

```tsx
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Level, levelLabels } from "@/lib/analysis";
import { AuthFormInput, AuthUser, ProfileFormInput } from "@/lib/apiClient";
import { AVATAR_ICONS, AvatarMark } from "./AvatarMark";
import {
  Theme,
  applyTheme,
  avatarColors,
  persistDistanceUnit,
  persistTheme,
  readPreferredDistanceUnit,
  readPreferredTheme,
} from "@/lib/preferences";
import type { DistanceUnit } from "@/lib/units";
import { OctagonSpinner } from "./OctagonSpinner";
import { PremiumBadge } from "./PremiumBadge";
```

Replace with:

```tsx
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthFormInput, AuthUser, ProfileFormInput } from "@/lib/apiClient";
import { AvatarMark } from "./AvatarMark";
import {
  Theme,
  applyTheme,
  persistDistanceUnit,
  persistTheme,
  readPreferredDistanceUnit,
  readPreferredTheme,
} from "@/lib/preferences";
import type { DistanceUnit } from "@/lib/units";
import { OctagonSpinner } from "./OctagonSpinner";
import { SettingsModal } from "./SettingsModal";
```

- [ ] **Step 2: Remove `subscriptionLabels` constant**

Find and delete this block (currently just before the `AuthPanel` function body):

```tsx
const subscriptionLabels: Record<AuthUser["subscription"], string> = {
  ACTIVE: "Premium",
  CANCELED: "Subscription canceled",
  FREE: "Free account",
  PAST_DUE: "Payment past due",
};
```

It has moved to `SettingsModal.tsx`.

- [ ] **Step 3: Replace the state declarations**

The current `useState` / `useRef` block inside `AuthPanel` is:

```tsx
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileLevel, setProfileLevel] = useState<Level>("competitive");
  const [profileTargetTime, setProfileTargetTime] = useState("1:25:00");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const accountRef = useRef<HTMLElement>(null);
```

Replace with:

```tsx
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const accountRef = useRef<HTMLElement>(null);
```

- [ ] **Step 4: Replace the logged-in `if (user)` branch**

Find the entire `if (user) { ... return (...); }` block and replace it with:

```tsx
  if (user) {
    return (
      <aside className="auth-panel auth-panel--signed-in auth-panel--compact">
        <button
          className="auth-panel__account-trigger"
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-haspopup="dialog"
        >
          <span
            className={
              isPremium
                ? "auth-panel__avatar auth-panel__avatar--premium"
                : "auth-panel__avatar"
            }
            style={{ background: avatarColor }}
            aria-hidden="true"
          >
            <AvatarMark icon={avatarIcon} initial={userInitial} />
          </span>
          <span className="auth-panel__chevron" aria-hidden="true" />
        </button>
        {settingsOpen ? (
          <SettingsModal
            user={user}
            theme={theme}
            loading={loading}
            billingLoading={billingLoading}
            distanceUnit={distanceUnit}
            onDistanceUnitChange={updateUnit}
            avatarColor={avatarColor}
            onAvatarColorChange={onAvatarColorChange}
            avatarIcon={avatarIcon}
            onAvatarIconChange={onAvatarIconChange}
            onThemeChange={updateTheme}
            onLogout={onLogout}
            onStartCheckout={onStartCheckout}
            onManageBilling={onManageBilling}
            onResendVerification={onResendVerification}
            onSaveProfile={onSaveProfile}
            onDeleteAccount={onDeleteAccount}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
      </aside>
    );
  }
```

Note: `isPremium`, `displayName`, and `userInitial` are computed at the top of the component body from `user`. Confirm those three lines remain after the state block.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If TypeScript reports unused variables (`displayName`, `userInitial`) they are used in the trigger button's avatar — double-check the avatar `<span>` renders them. If TypeScript complains about `isPremium` not existing, add it above the `if (user)` block:

```tsx
  const isPremium = user?.subscription === "ACTIVE";
  const displayName = user?.name || user?.email || "";
  const userInitial = displayName.trim().charAt(0).toUpperCase() || "O";
```

- [ ] **Step 6: Remove old dropdown CSS classes from `styles/_auth.scss`**

Delete the following rules from `styles/_auth.scss` (search for each selector):

1. `.auth-panel--signed-in .auth-panel__menu-item { ... }` and any `:hover` variants
2. `.auth-panel--signed-in .auth-panel__upgrade { ... }` and its `:hover`
3. `.auth-panel--signed-in .auth-panel__menu-item--danger { ... }` and its `:hover`
4. `.auth-panel__delete-confirm { ... }`
5. `.auth-panel__delete-confirm p { ... }`
6. `.auth-panel__delete-confirm-actions { ... }`
7. `.auth-panel__delete-confirm-actions button { ... }`

Do **not** delete: `.auth-panel__account-menu`, `.auth-panel__account-summary`, `.auth-panel__email`, `.auth-panel__meta`, `.auth-panel__verify`, `.auth-panel__defaults` — search to confirm whether any of these are used in the guest-state dropdown before deleting. If in doubt, leave them; unused CSS does not cause a build error.

- [ ] **Step 7: Final type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/AuthPanel.tsx styles/_auth.scss
git commit -m "Refactor AuthPanel to open SettingsModal instead of account dropdown"
```

---

### Task 4: Manual verification

**Files:** none (dev server only — no commit for this task)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Wait until ready on `http://127.0.0.1:3002`.

- [ ] **Step 2: Verify modal opens and closes**

Sign in with a test account, then:
1. Click the avatar trigger — settings modal opens (not a dropdown).
2. Press `Escape` — modal closes.
3. Open again, click the dark backdrop outside the modal card — modal closes.
4. Open again, click the × button — modal closes.

- [ ] **Step 3: Verify Profile tab**

1. Name, email (read-only + Verified/Unverified badge), default level select, target time, avatar icons, and colour swatches all render.
2. Edit the name field and click "Save profile" — saves without closing the modal.
3. Click an avatar icon or colour swatch — avatar in the header updates immediately.

- [ ] **Step 4: Verify Appearance tab**

1. Theme (Light/Dark) and Distance (KM/Miles) toggles render.
2. Switching theme applies immediately to the whole app — no save button.
3. Switching distance applies immediately.

- [ ] **Step 5: Verify Billing tab**

1. Correct subscription label is shown.
2. Free account shows "Upgrade to premium"; active shows "Manage billing".

- [ ] **Step 6: Verify Privacy tab**

1. "Your data" section shows "↓ Download my data" link — clicking it downloads `ocht-data-export.json`.
2. "Danger zone" card shows "Delete account" (red outline button).
3. Click "Delete account" — confirm card appears with "Are you sure?" copy and Cancel / Yes delete buttons.
4. Click "Cancel" — confirm card disappears, "Delete account" button returns.

- [ ] **Step 7: Verify guest flow is unchanged**

Sign out, then click the avatar — the existing guest dropdown opens (not a modal). Login and signup forms still work.

- [ ] **Step 8: Stop the dev server**

Stop `npm run dev` (Ctrl+C).

---

## Notifications — Phase 2

Three notification features surfaced in the Settings mockup (Design C). Scope and implementation plan for each below.

### Overview

| Feature | Trigger | Delivery (v1) | Effort |
|---|---|---|---|
| PR Alert | Race saved, beats existing best | In-app (Results Reveal highlight) | Small |
| Archetype Change | Race saved, archetype shifts | In-app (Results Reveal moment) | Small |
| Race Reminders | Cron: 7 days before upcoming race date | Email (Resend) | Medium |

Notification preferences are stored as a JSON column on the `User` model. All three toggles default **on**.

---

### Task 5: Add notification prefs to the DB schema

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `prisma migrate dev`

- [ ] **Step 1: Add `notificationPrefs` to `User` model**

```prisma
model User {
  // ... existing fields ...
  notificationPrefs Json @default("{\"prAlerts\":true,\"archetypeChange\":true,\"raceReminders\":true}")
}
```

- [ ] **Step 2: Create and apply migration**

```bash
npx prisma migrate dev --name add_notification_prefs
```

- [ ] **Step 3: Add type helper to `lib/notificationPrefs.ts`**

```ts
export type NotificationPrefs = {
  prAlerts: boolean;
  archetypeChange: boolean;
  raceReminders: boolean;
};

export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const defaults: NotificationPrefs = { prAlerts: true, archetypeChange: true, raceReminders: true };
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Record<string, unknown>;
  return {
    prAlerts: r.prAlerts !== false,
    archetypeChange: r.archetypeChange !== false,
    raceReminders: r.raceReminders !== false,
  };
}
```

- [ ] **Step 4: Expose prefs via `GET /api/auth/me`**

Add `notificationPrefs` to the user object returned by the `/api/auth/me` GET handler so the settings modal can read it on load.

- [ ] **Step 5: Accept prefs update via `PATCH /api/auth/me`**

Extend the PATCH handler to accept `notificationPrefs: Partial<NotificationPrefs>` and merge-update the JSON column (do not overwrite unset keys).

- [ ] **Step 6: Commit**

```bash
git add prisma/ lib/notificationPrefs.ts app/api/auth/me/
git commit -m "feat: add notification prefs schema and API support"
```

---

### Task 6: Add Notifications tab to `SettingsModal`

**Files:**
- Modify: `components/SettingsModal.tsx`
- Modify: `styles/_auth.scss`

- [ ] **Step 1: Add `"notifications"` to the `Tab` type**

```ts
type Tab = "profile" | "appearance" | "billing" | "notifications" | "privacy";
```

Update the tab render list to include `"notifications"` between `"billing"` and `"privacy"`.

- [ ] **Step 2: Add props for notification prefs**

```tsx
notificationPrefs: NotificationPrefs;
onSaveNotificationPrefs: (prefs: Partial<NotificationPrefs>) => Promise<void>;
```

- [ ] **Step 3: Add the Notifications tab panel**

```tsx
{activeTab === "notifications" && (
  <div className="settings-modal__notifications">
    <NotificationToggle
      label="PR Alerts"
      description="Highlighted in your results when a race sets a new personal best."
      checked={localPrefs.prAlerts}
      onChange={(v) => updatePref("prAlerts", v)}
    />
    <NotificationToggle
      label="Archetype Change"
      description="Shown in results when your race profile shifts to a new archetype."
      checked={localPrefs.archetypeChange}
      onChange={(v) => updatePref("archetypeChange", v)}
    />
    <NotificationToggle
      label="Race Reminders"
      description="Email 7 days before an upcoming race you've logged."
      checked={localPrefs.raceReminders}
      onChange={(v) => updatePref("raceReminders", v)}
    />
    <div className="settings-modal__form-actions">
      <button type="button" onClick={savePrefs} disabled={saving}>
        {saving ? "Saving..." : "Save preferences"}
      </button>
    </div>
  </div>
)}
```

Where `NotificationToggle` is a small inline component (label + description + toggle switch). Use local state `localPrefs` initialised from the `notificationPrefs` prop; call `onSaveNotificationPrefs` on save.

- [ ] **Step 4: Add `.settings-modal__notifications` CSS**

Append to `styles/_auth.scss`:

```scss
.settings-modal__notifications {
  display: grid;
  gap: 0;
}

.settings-modal__notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);

  &:last-of-type { border-bottom: none; }
}

.settings-modal__notif-info {
  flex: 1;

  strong { display: block; font-size: 0.88rem; color: var(--ink); margin-bottom: 3px; }
  span   { font-size: 0.8rem; color: var(--teal); }
}

.settings-modal__toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--line);
  border: none;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;

  &::after {
    content: '';
    position: absolute;
    width: 14px; height: 14px;
    background: #fff;
    border-radius: 50%;
    top: 3px; left: 3px;
    transition: left 0.15s;
  }

  &[aria-checked="true"] {
    background: var(--green);
    &::after { left: 19px; background: #000; }
  }
}
```

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add components/SettingsModal.tsx styles/_auth.scss
git commit -m "feat: add Notifications tab to SettingsModal"
```

---

### Task 7: PR Alert — in-app moment on Results Reveal

**Files:**
- Modify: `lib/raceReport.ts` (or wherever race results are computed/saved)
- Modify: `components/ResultsReveal.tsx`

When a race report is saved, compare the new finish time against the user's existing best stored in their race history.

- [ ] **Step 1: Add `isPR` and `prevBest` to the race save response**

In the API route that saves a race result (e.g. `POST /api/reports`), after upserting the record, query for the user's previous best finish time. Add to the response:

```ts
{
  // ... existing fields ...
  isPR: boolean;          // true if this finish time beats all previous
  prevBest: string | null; // previous best time string, e.g. "1:05:50", null if debut
}
```

Check against `notificationPrefs.prAlerts` — only set `isPR: true` if the pref is enabled.

- [ ] **Step 2: Surface PR moment in `ResultsReveal`**

When `isPR` is true, show a highlighted callout at the top of the results screen:

```
┌─────────────────────────────────────────────┐
│  ★  New Personal Best  −1:18 vs 1:05:50    │
└─────────────────────────────────────────────┘
```

Lime background, black text, Saira Condensed. Animate in (fade + slide up, 300ms).

- [ ] **Step 3: Commit**

```bash
git add lib/ components/ResultsReveal.tsx
git commit -m "feat: PR alert moment on Results Reveal"
```

---

### Task 8: Archetype Change — in-app moment on Results Reveal

**Files:**
- Modify: `lib/raceReport.ts` (or archetype computation)
- Modify: `components/ResultsReveal.tsx`

- [ ] **Step 1: Track previous archetype on race save**

When saving a race result, read the user's archetype from their most recent *previous* report. Compare to the newly computed archetype. Add to the save response:

```ts
{
  archetypeChanged: boolean;
  prevArchetype: string | null; // e.g. "Steady Dagda", null if debut
}
```

Only set `archetypeChanged: true` if `notificationPrefs.archetypeChange` is enabled.

- [ ] **Step 2: Surface archetype shift moment in `ResultsReveal`**

When `archetypeChanged` is true and there was a previous archetype, show a reveal moment below the score hero:

```
┌─────────────────────────────────────────────┐
│  [shield]  Archetype Shift                  │
│  Steady Dagda → The Rowing Engine           │
└─────────────────────────────────────────────┘
```

Teal left-accent border, dark background. Renders below the PR callout if both are true.

- [ ] **Step 3: Commit**

```bash
git add lib/ components/ResultsReveal.tsx
git commit -m "feat: archetype change moment on Results Reveal"
```

---

### Task 9: Race Reminders — email via Resend + cron

> **Scope note:** This task requires an upcoming race date on each report and an email delivery service. Implement after Tasks 5–8 are shipped.

**Files:**
- Modify: `prisma/schema.prisma` — add `upcomingRaceDate DateTime?` to `RaceReport`
- Create: `lib/email/raceReminder.ts`
- Create: `app/api/cron/race-reminders/route.ts`
- Modify: `components/SplitForm.tsx` — add optional "Next race date" field

**Dependencies:**
- Resend account + `RESEND_API_KEY` env var
- Vercel Cron (or equivalent) to call `/api/cron/race-reminders` daily

- [ ] **Step 1: Add `upcomingRaceDate` to schema**

```prisma
model RaceReport {
  // ... existing fields ...
  upcomingRaceDate DateTime?
}
```

Run `npx prisma migrate dev --name add_upcoming_race_date`.

- [ ] **Step 2: Add "Next race date" field to `SplitForm`**

Optional date input at the bottom of the form ("Planning another race? Add the date for a reminder"). Maps to `upcomingRaceDate`. No validation — entirely optional.

- [ ] **Step 3: Create `lib/email/raceReminder.ts`**

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendRaceReminder(to: string, raceName: string, raceDate: Date) {
  const daysOut = Math.round((raceDate.getTime() - Date.now()) / 86400000);
  await resend.emails.send({
    from: "Ocht <reminders@ocht.app>",
    to,
    subject: `${daysOut} days to race day`,
    html: `<p>Your upcoming race is in ${daysOut} days. Check your Ocht race plan.</p>`,
  });
}
```

Replace the HTML body with a proper branded template once email design is finalised.

- [ ] **Step 4: Create cron route `app/api/cron/race-reminders/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseNotificationPrefs } from "@/lib/notificationPrefs";
import { sendRaceReminder } from "@/lib/email/raceReminder";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

  const reports = await prisma.raceReport.findMany({
    where: { upcomingRaceDate: { gte: dayStart, lte: dayEnd } },
    include: { user: true },
  });

  let sent = 0;
  for (const report of reports) {
    const prefs = parseNotificationPrefs(report.user.notificationPrefs);
    if (!prefs.raceReminders || !report.user.email) continue;
    await sendRaceReminder(report.user.email, "your race", report.upcomingRaceDate!);
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
```

- [ ] **Step 5: Configure Vercel Cron**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/race-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Set `CRON_SECRET` and `RESEND_API_KEY` in Vercel environment variables.

- [ ] **Step 6: Add env vars to `.env.example`**

```
RESEND_API_KEY=
CRON_SECRET=   # random secret; set same value in Vercel env
```

- [ ] **Step 7: Commit**

```bash
git add prisma/ lib/email/ app/api/cron/ components/SplitForm.tsx vercel.json .env.example
git commit -m "feat: race reminder emails via Resend + Vercel Cron"
```
