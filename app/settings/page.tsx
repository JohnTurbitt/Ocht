"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Level, formatTime, levelLabels } from "@/lib/analysis";
import {
  AuthUser,
  ProfileFormInput,
  deleteAccount,
  getCurrentUser,
  openBillingPortal,
  resendEmailVerification,
  startCheckout,
  updateProfile,
} from "@/lib/apiClient";
import { SavedReport, loadSavedReports } from "@/lib/reportStorage";
import { raceFormatLabels, type RaceFormat } from "@/lib/raceFormats";
import { AVATAR_ICONS, AvatarMark } from "@/components/AvatarMark";
import {
  Theme,
  applyTheme,
  avatarColors,
  persistAvatarColor,
  persistAvatarIcon,
  persistDistanceUnit,
  persistTheme,
  readAvatarColor,
  readAvatarIcon,
  readPreferredDistanceUnit,
  readPreferredTheme,
} from "@/lib/preferences";
import type { DistanceUnit } from "@/lib/units";
import { OctagonSpinner } from "@/components/OctagonSpinner";
import { PremiumBadge } from "@/components/PremiumBadge";

type Section = "profile" | "appearance" | "billing" | "privacy";

const subscriptionLabels: Record<AuthUser["subscription"], string> = {
  ACTIVE: "Premium",
  CANCELED: "Subscription canceled",
  FREE: "Free account",
  PAST_DUE: "Payment past due",
};

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Preferences
  const [theme, setTheme] = useState<Theme>("dark");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  const [avatarColor, setAvatarColor] = useState<string>(avatarColors[0]);
  const [avatarIcon, setAvatarIcon] = useState<string>("initial");

  // Reports
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // Profile form
  const [profileName, setProfileName] = useState("");
  const [profileLevel, setProfileLevel] = useState<Level>("competitive");
  const [profileTargetTime, setProfileTargetTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Billing
  const [billingLoading, setBillingLoading] = useState(false);

  // Privacy
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);
  const [stravaSyncedAt, setStravaSyncedAt] = useState<string | null>(null);
  const [stravaDisconnecting, setStravaDisconnecting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Boot: fetch user, redirect if unauthenticated, load prefs + reports
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const currentUser = await getCurrentUser();
        if (cancelled) return;

        if (!currentUser) {
          router.replace("/");
          return;
        }

        setUser(currentUser);
        setProfileName(currentUser.name ?? "");
        setProfileLevel(currentUser.defaultLevel);
        setProfileTargetTime(currentUser.defaultTargetTime);

        // Load saved reports (remote if signed in, local otherwise)
        try {
          const { loadRemoteReports } = await import("@/lib/apiClient");
          const reports = await loadRemoteReports();
          if (!cancelled) setSavedReports(reports);
        } catch {
          if (!cancelled) setSavedReports(loadSavedReports());
        }
      } catch {
        if (!cancelled) router.replace("/");
      } finally {
        if (!cancelled) setUserLoading(false);
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, [router]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const t = readPreferredTheme();
    setTheme(t);
    applyTheme(t);
    setDistanceUnit(readPreferredDistanceUnit());
    setAvatarColor(readAvatarColor());
    setAvatarIcon(readAvatarIcon());
  }, []);

  // Load Strava status when privacy section is first visited
  useEffect(() => {
    if (activeSection !== "privacy") return;
    if (stravaConnected !== null) return;

    fetch("/api/strava/status")
      .then((r) => r.json())
      .then((data: { connected: boolean; syncedAt: string | null }) => {
        setStravaConnected(data.connected);
        setStravaSyncedAt(data.syncedAt);
      })
      .catch(() => {});
  }, [activeSection, stravaConnected]);

  // PB computation
  const formatPBs = (() => {
    const byFormat = new Map<string, SavedReport[]>();
    for (const r of savedReports) {
      const key = r.raceFormat ?? "hyrox";
      const group = byFormat.get(key) ?? [];
      group.push(r);
      byFormat.set(key, group);
    }
    return [...byFormat.entries()].map(([format, reports]) => {
      const sorted = [...reports].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const best = reports.reduce((b, r) => (r.finishSeconds < b.finishSeconds ? r : b));
      const improvement = sorted[0].finishSeconds - best.finishSeconds;
      return { format, best, improvement, count: reports.length };
    });
  })();

  const isPremium = user?.subscription === "ACTIVE";
  const canManageBilling =
    user?.subscription === "ACTIVE" || user?.subscription === "PAST_DUE";
  const canUpgrade =
    user?.subscription === "FREE" || user?.subscription === "CANCELED";
  const displayName = user?.name || user?.email || "";
  const userInitial = displayName.trim().charAt(0).toUpperCase() || "O";

  // Handlers
  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const input: ProfileFormInput = {
        name: profileName,
        defaultLevel: profileLevel,
        defaultTargetTime: profileTargetTime,
      };
      const updatedUser = await updateProfile(input);
      setUser(updatedUser);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    await resendEmailVerification();
  }

  function handleThemeChange(nextTheme: Theme) {
    persistTheme(nextTheme);
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  function handleDistanceUnitChange(unit: DistanceUnit) {
    persistDistanceUnit(unit);
    setDistanceUnit(unit);
  }

  function handleAvatarColorChange(color: string) {
    persistAvatarColor(color);
    setAvatarColor(color);
  }

  function handleAvatarIconChange(icon: string) {
    persistAvatarIcon(icon);
    setAvatarIcon(icon);
  }

  async function handleStartCheckout() {
    setBillingLoading(true);
    try {
      window.location.href = await startCheckout();
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    try {
      window.location.href = await openBillingPortal();
    } finally {
      setBillingLoading(false);
    }
  }

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

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      router.replace("/");
    } finally {
      setDeleting(false);
    }
  }

  function switchSection(section: Section) {
    setActiveSection(section);
    setDeleteConfirmOpen(false);
  }

  if (userLoading) {
    return (
      <div className="settings-page">
        <div className="settings-topbar">
          <Link href="/" className="settings-topbar__back">← Ocht</Link>
          <span className="settings-topbar__title">Settings</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const sections: { id: Section; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "appearance", label: "Appearance" },
    { id: "billing", label: "Billing" },
    { id: "privacy", label: "Privacy" },
  ];

  return (
    <div className="settings-page">
      {/* Top bar */}
      <div className="settings-topbar">
        <Link href="/" className="settings-topbar__back">← Ocht</Link>
        <span className="settings-topbar__title">Settings</span>
        <span
          className={isPremium ? "auth-panel__avatar auth-panel__avatar--premium" : "auth-panel__avatar"}
          style={{ background: avatarColor }}
          aria-hidden="true"
        >
          <AvatarMark icon={avatarIcon} initial={userInitial} />
        </span>
      </div>

      {/* Body */}
      <div className="settings-body">
        {/* Sidebar nav */}
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? "settings-nav__item is-active" : "settings-nav__item"}
              onClick={() => switchSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content">

          {/* Profile */}
          {activeSection === "profile" && (
            <>
              <h2 className="settings-section-heading">Profile</h2>

              {formatPBs.length > 0 && (
                <div className="settings-pb">
                  <div className="settings-pb__cards">
                    {formatPBs.map(({ format, best, improvement }) => (
                      <div key={format} className="settings-pb__card">
                        <p className="settings-pb__format">
                          {raceFormatLabels[format as RaceFormat] ?? format}
                        </p>
                        <p className="settings-pb__time">{formatTime(best.finishSeconds)}</p>
                        <p className="settings-pb__meta">
                          {new Date(best.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {improvement > 0 && <> · −{formatTime(improvement)}</>}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="settings-pb__footer">
                    <span className="settings-pb__count">
                      {savedReports.length} {savedReports.length === 1 ? "race" : "races"}
                    </span>
                    <Link href="/" className="settings-pb__view">View race history →</Link>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="settings-form">
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
                      onClick={() => void handleResendVerification()}
                      disabled={submitting}
                    >
                      Resend verification email
                    </button>
                  </div>
                )}
                <label className="field">
                  <span>Default athlete level</span>
                  <select
                    value={profileLevel}
                    onChange={(e) => setProfileLevel(e.target.value as Level)}
                  >
                    {Object.entries(levelLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
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
                <div className="settings-form__actions">
                  <button type="submit" disabled={submitting}>
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
            </>
          )}

          {/* Appearance */}
          {activeSection === "appearance" && (
            <>
              <h2 className="settings-section-heading">Appearance</h2>
              <div className="account-settings">
                <div className="account-settings__group">
                  <span className="account-settings__label">Theme</span>
                  <div className="account-settings__switch">
                    <button
                      type="button"
                      className={theme === "light" ? "is-active" : undefined}
                      onClick={() => handleThemeChange("light")}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      className={theme === "dark" ? "is-active" : undefined}
                      onClick={() => handleThemeChange("dark")}
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
                      className={distanceUnit === "km" ? "is-active" : undefined}
                      onClick={() => handleDistanceUnitChange("km")}
                    >
                      KM
                    </button>
                    <button
                      type="button"
                      className={distanceUnit === "mi" ? "is-active" : undefined}
                      onClick={() => handleDistanceUnitChange("mi")}
                    >
                      Miles
                    </button>
                  </div>
                </div>
                <div className="account-settings avatar-picker">
                  <span className="account-settings__label">Avatar</span>
                  <div className="avatar-icons">
                    {AVATAR_ICONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={option.id === avatarIcon ? "avatar-icon is-active" : "avatar-icon"}
                        onClick={() => handleAvatarIconChange(option.id)}
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
                        className={color === avatarColor ? "avatar-swatch is-active" : "avatar-swatch"}
                        style={{ background: color }}
                        onClick={() => handleAvatarColorChange(color)}
                        aria-label={`Use ${color} avatar colour`}
                        aria-pressed={color === avatarColor}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Billing */}
          {activeSection === "billing" && (
            <>
              <h2 className="settings-section-heading">Billing</h2>
              <div className="settings-modal__billing">
                <p className="settings-modal__billing-status">
                  {subscriptionLabels[user.subscription]}
                  {isPremium ? (
                    <> <PremiumBadge /></>
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
                    onClick={() => void handleStartCheckout()}
                    disabled={billingLoading}
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
                    onClick={() => void handleManageBilling()}
                    disabled={billingLoading}
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
            </>
          )}

          {/* Privacy */}
          {activeSection === "privacy" && (
            <>
              <h2 className="settings-section-heading">Privacy</h2>
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
                        onClick={() => void handleStravaDisconnect()}
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
                  <p>Download a copy of your account and all saved reports as JSON.</p>
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
                      Permanently deletes your account, all reports, and cancels your subscription. This cannot be undone.
                    </p>
                    {deleteConfirmOpen ? (
                      <div className="settings-modal__delete-confirm">
                        <p>Are you sure? We recommend downloading your data first.</p>
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
                            onClick={() => void handleDeleteAccount()}
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
                      >
                        Delete account
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
