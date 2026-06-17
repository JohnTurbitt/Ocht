"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Level, formatTime, levelLabels } from "@/lib/analysis";
import { AuthUser, ProfileFormInput } from "@/lib/apiClient";
import { SavedReport } from "@/lib/reportStorage";
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
  savedReports?: SavedReport[];
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
  savedReports = [],
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
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);
  const [stravaSyncedAt, setStravaSyncedAt] = useState<string | null>(null);
  const [stravaDisconnecting, setStravaDisconnecting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const pb = savedReports.length > 0
    ? savedReports.reduce((best, r) => r.finishSeconds < best.finishSeconds ? r : best)
    : null;

  const improvement = savedReports.length >= 2
    ? (() => {
        const sorted = [...savedReports].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return sorted[0].finishSeconds - sorted[sorted.length - 1].finishSeconds;
      })()
    : null;

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

  useEffect(() => {
    fetch("/api/strava/status")
      .then((r) => r.json())
      .then((data) => {
        setStravaConnected(data.connected);
        setStravaSyncedAt(data.syncedAt);
      })
      .catch(() => {});
  }, []);

  async function handleStravaDisconnect() {
    setStravaDisconnecting(true);
    try {
      const res = await fetch("/api/strava/connection", { method: "DELETE" });
      if (res.ok) {
        setStravaConnected(false);
        setStravaSyncedAt(null);
      }
    } finally {
      setStravaDisconnecting(false);
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

        {savedReports.length > 0 && (
          <div className="settings-stats">
            <div className="settings-stats__item">
              <span>Personal best</span>
              <strong>{pb ? formatTime(pb.finishSeconds) : "—"}</strong>
            </div>
            <div className="settings-stats__item">
              <span>Reports</span>
              <strong>{savedReports.length}</strong>
            </div>
            {improvement !== null && improvement > 0 && (
              <div className="settings-stats__item">
                <span>Improvement</span>
                <strong>−{formatTime(improvement)}</strong>
              </div>
            )}
          </div>
        )}

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
              <section className="settings-modal__section">
                <h3 className="settings-modal__section-title">Strava</h3>
                {stravaConnected === null && (
                  <p className="settings-modal__hint">Loading…</p>
                )}
                {stravaConnected === false && (
                  <>
                    <p className="settings-modal__hint">
                      Connect Strava to auto-fill your training data and get personalised predictions.
                    </p>
                    <a
                      href="/api/strava/connect"
                      className="settings-modal__btn settings-modal__btn--primary"
                    >
                      Connect with Strava
                    </a>
                  </>
                )}
                {stravaConnected === true && (
                  <>
                    <p className="settings-modal__hint">
                      Connected
                      {stravaSyncedAt
                        ? ` · Last synced ${new Date(stravaSyncedAt).toLocaleDateString()}`
                        : ""}
                    </p>
                    <button
                      className="settings-modal__btn settings-modal__btn--danger"
                      onClick={handleStravaDisconnect}
                      disabled={stravaDisconnecting}
                    >
                      {stravaDisconnecting ? "Disconnecting…" : "Disconnect Strava"}
                    </button>
                  </>
                )}
              </section>

              <hr className="settings-modal__divider" />

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
