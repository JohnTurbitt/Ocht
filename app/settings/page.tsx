"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Level, levelLabels } from "@/lib/analysis";
import {
  AuthUser,
  ProfileFormInput,
  deleteAccount,
  getCurrentUser,
  logOut,
  openBillingPortal,
  resendEmailVerification,
  startCheckout,
  updateProfile,
} from "@/lib/apiClient";
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

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("section");
    if (param === "profile" || param === "appearance" || param === "billing" || param === "privacy") {
      setActiveSection(param);
    }
  }, []);

  // Preferences
  const [theme, setTheme] = useState<Theme>("dark");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  const [avatarColor, setAvatarColor] = useState<string>(avatarColors[0]);
  const [avatarIcon, setAvatarIcon] = useState<string>("initial");

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
  const [loggingOut, setLoggingOut] = useState(false);

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
      window.location.href = await startCheckout("/settings?section=billing");
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    try {
      window.location.href = await openBillingPortal("/settings?section=billing");
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

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logOut();
      router.replace("/");
    } finally {
      setLoggingOut(false);
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
          <Link href="/" className="settings-topbar__brand">Ocht</Link>
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
        <Link href="/" className="settings-topbar__brand">Ocht</Link>
        <span className="settings-topbar__title">Settings</span>
        <span
          className={isPremium ? "auth-panel__avatar auth-panel__avatar--premium" : "auth-panel__avatar"}
          style={{ background: avatarColor }}
          aria-hidden="true"
        >
          <AvatarMark icon={avatarIcon} initial={userInitial} />
        </span>
      </div>

      <div className="settings-layout">
        {/* Sidebar */}
        <aside className="settings-sidebar">
          <div className="settings-sidebar__user">
            <span
              className={isPremium ? "auth-panel__avatar auth-panel__avatar--premium" : "auth-panel__avatar"}
              style={{ background: avatarColor }}
              aria-hidden="true"
            >
              <AvatarMark icon={avatarIcon} initial={userInitial} />
            </span>
            <div className="settings-sidebar__user-info">
              <strong>{displayName}</strong>
              <span>{subscriptionLabels[user.subscription]}</span>
            </div>
          </div>
          <nav className="settings-sidebar__nav" aria-label="Settings sections">
            {sections.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={activeSection === id ? "settings-sidebar__item is-active" : "settings-sidebar__item"}
                onClick={() => switchSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="settings-sidebar__logout"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <span className="button-loading">
                <OctagonSpinner size={16} />
                Signing out...
              </span>
            ) : (
              "Log out"
            )}
          </button>
        </aside>

        {/* Main content */}
        <main className="settings-main">

          {/* ── Profile ── */}
          {activeSection === "profile" && (
            <>
              <div className="settings-card">
                <div className="settings-card__head"><h3>Profile</h3></div>
                <div className="settings-card__body">
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
                      <div className="settings-email-row">
                        <input value={user.email} readOnly aria-readonly="true" />
                        <span className={user.emailVerified ? "settings-badge settings-badge--verified" : "settings-badge settings-badge--unverified"}>
                          {user.emailVerified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                    </label>
                    {!user.emailVerified && (
                      <div className="settings-verify-strip">
                        <p>Verify your email to keep account recovery reliable.</p>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => void handleResendVerification()}
                          disabled={submitting}
                        >
                          Resend email
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
                </div>
              </div>
            </>
          )}

          {/* ── Appearance ── */}
          {activeSection === "appearance" && (
            <>
              <div className="settings-card">
                <div className="settings-card__head"><h3>Display</h3></div>
                <div className="settings-card__body">
                  <div className="settings-toggle-row">
                    <span className="settings-toggle-label">Theme</span>
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
                  <div className="settings-toggle-row">
                    <span className="settings-toggle-label">Distance</span>
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
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card__head"><h3>Avatar</h3></div>
                <div className="settings-card__body">
                  <div className="settings-avatar-section">
                    <p className="settings-avatar-label">Icon</p>
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
                    <p className="settings-avatar-label">Colour</p>
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
              </div>
            </>
          )}

          {/* ── Billing ── */}
          {activeSection === "billing" && (
            <div className={isPremium ? "settings-plan-card settings-plan-card--premium" : "settings-plan-card"}>
              <div className="settings-plan-card__info">
                <div className="settings-plan-card__tier">
                  {subscriptionLabels[user.subscription]}
                  {isPremium && <PremiumBadge />}
                </div>
                <div className="settings-plan-card__desc">
                  {user.subscription === "PAST_DUE"
                    ? "Payment past due. Please update your billing details."
                    : isPremium
                      ? "Full access to all features and insights."
                      : "Upgrade to unlock Fitness Insights, Race Blueprint and more."}
                </div>
              </div>
              {canUpgrade && (
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
              )}
              {canManageBilling && (
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
              )}
            </div>
          )}

          {/* ── Privacy ── */}
          {activeSection === "privacy" && (
            <>
              <div className="settings-card">
                <div className="settings-card__head"><h3>Strava</h3></div>
                <div className="settings-card__body">
                  {stravaConnected === null && (
                    <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>Loading…</p>
                  )}
                  {stravaConnected === false && (
                    <div className="settings-data-row">
                      <p>Connect Strava to auto-fill your training data and get personalised predictions.</p>
                      <a href="/api/strava/connect" className="strava-connect-btn">
                        <img src="/brand/strava/btn_strava_connect_with_orange.svg" alt="Connect with Strava" />
                      </a>
                    </div>
                  )}
                  {stravaConnected === true && (
                    <div className="settings-strava-status">
                      <span className="settings-strava-badge">
                        Connected{stravaSyncedAt ? ` · synced ${new Date(stravaSyncedAt).toLocaleDateString()}` : ""}
                      </span>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => void handleStravaDisconnect()}
                        disabled={stravaDisconnecting}
                      >
                        {stravaDisconnecting ? "Disconnecting…" : "Disconnect"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card__head"><h3>Your data</h3></div>
                <div className="settings-card__body">
                  <div className="settings-data-row">
                    <p>Download a copy of your account and all saved reports as JSON.</p>
                    <a className="button-secondary" href="/api/auth/me/export">↓ Download</a>
                  </div>
                </div>
              </div>

              <div className="settings-danger-card">
                <div className="settings-danger-card__head"><h3>Danger zone</h3></div>
                <div className="settings-danger-card__body">
                  <strong>Delete account</strong>
                  <p>Permanently deletes your account, all reports and cancels your subscription. This cannot be undone.</p>
                  {deleteConfirmOpen ? (
                    <div className="settings-danger-confirm">
                      <p>Are you sure? We recommend downloading your data first.</p>
                      <div className="settings-danger-actions">
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
                          className="settings-delete-btn"
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
                            "Yes, delete my account"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="settings-delete-btn"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      Delete account
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
}
