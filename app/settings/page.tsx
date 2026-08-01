"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Level, formatTime, levelLabels, parseTime, stations, buildAnalysis } from "@/lib/analysis";
import { AthleteArchetypeCard } from "@/components/AthleteArchetypeCard";
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
import { PBTrophyBadge } from "@/components/PBTrophyBadge";
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

  // Reports
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);

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
      const byTime = [...reports].sort((a, b) => a.finishSeconds - b.finishSeconds);
      const top3 = byTime.slice(0, 3).map((report, idx) => {
        const runSecs = report.runs.map(parseTime).filter((n) => n > 0);
        const bestRunSec = runSecs.length ? Math.min(...runSecs) : null;

        const stationDefs = report.stationDefinitions ?? stations;
        const stationEntries = Object.entries(report.stationSplits)
          .map(([key, val]) => ({ key, sec: parseTime(val) }))
          .filter((e) => e.sec > 0);
        const bestStationEntry = stationEntries.length
          ? stationEntries.reduce((a, b) => (a.sec < b.sec ? a : b))
          : null;
        const bestStationLabel = bestStationEntry
          ? (stationDefs.find((s) => s.key === bestStationEntry.key)?.label ?? bestStationEntry.key)
          : null;
        const bestStationTime = bestStationEntry?.sec ?? null;

        return { report, rank: (idx + 1) as 1 | 2 | 3, bestRunSec, bestStationLabel, bestStationTime };
      });

      return { format, top3, count: reports.length };
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
              {formatPBs.length > 0 && (
                <div className="settings-pb-hero">
                  {formatPBs.map(({ format, top3, count }) => (
                    <div key={format}>
                      <div className="settings-pb-hero__format-label">
                        {raceFormatLabels[format as RaceFormat] ?? format}
                      </div>
                      <div className="settings-pb-hero__podium">
                        {top3.map(({ report, rank, bestRunSec, bestStationLabel, bestStationTime }) => (
                          <button
                            key={rank}
                            type="button"
                            className={`settings-pb-hero__entry settings-pb-hero__entry--rank${rank}`}
                            onClick={() => setSelectedReport(report)}
                            aria-label={`View archetype for ${rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"} place result`}
                          >
                            <PBTrophyBadge rank={rank} size={80} />
                            <p className="settings-pb-hero__time">{formatTime(report.finishSeconds)}</p>
                            <p className="settings-pb-hero__meta">
                              {new Date(report.createdAt).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                            {(bestRunSec !== null || bestStationLabel !== null) && (
                              <p className="settings-pb-hero__meta">
                                {bestRunSec !== null && <>Run {formatTime(bestRunSec)}</>}
                                {bestRunSec !== null && bestStationLabel !== null && <> · </>}
                                {bestStationLabel !== null && bestStationTime !== null && (
                                  <>{bestStationLabel} {formatTime(bestStationTime)}</>
                                )}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="settings-pb-hero__footer">
                        <span className="settings-pb-hero__count">{count} {count === 1 ? "race" : "races"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                      <a href="/api/strava/connect" className="settings-connect-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                        </svg>
                        Connect with Strava
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

      {selectedReport && (() => {
        const analysis = buildAnalysis(
          selectedReport.goal,
          selectedReport.targetTime,
          selectedReport.level,
          selectedReport.runs,
          selectedReport.stationSplits,
          selectedReport.stationDefinitions ?? stations,
          selectedReport.raceFormat ?? "hyrox",
          selectedReport.officialFinishTime ?? "",
        );
        return (
          <div
            className="pb-archetype-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Athlete archetype"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedReport(null); }}
          >
            <div className="pb-archetype-modal__panel">
              <div className="pb-archetype-modal__header">
                <p className="pb-archetype-modal__date">
                  {new Date(selectedReport.createdAt).toLocaleDateString(undefined, {
                    day: "numeric", month: "long", year: "numeric",
                  })} · {formatTime(selectedReport.finishSeconds)}
                </p>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setSelectedReport(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <AthleteArchetypeCard analysis={analysis} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
