import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Level, levelLabels } from "@/lib/analysis";
import { AuthFormInput, AuthUser, ProfileFormInput } from "@/lib/apiClient";
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
import { PremiumBadge } from "./PremiumBadge";

type AuthPanelProps = {
  user: AuthUser | null;
  loading: boolean;
  billingLoading: boolean;
  distanceUnit: DistanceUnit;
  onDistanceUnitChange: (unit: DistanceUnit) => void;
  onLogin: (input: AuthFormInput) => Promise<void>;
  onSignup: (input: AuthFormInput) => Promise<void>;
  onLogout: () => Promise<void>;
  onStartCheckout: () => void;
  onManageBilling: () => void;
  onResendVerification: () => Promise<void>;
  onSaveProfile: (input: ProfileFormInput) => Promise<void>;
};

type AuthMode = "login" | "signup";

const subscriptionLabels: Record<AuthUser["subscription"], string> = {
  ACTIVE: "Premium",
  CANCELED: "Subscription canceled",
  FREE: "Free account",
  PAST_DUE: "Payment past due",
};

export function AuthPanel({
  user,
  loading,
  billingLoading,
  distanceUnit,
  onDistanceUnitChange,
  onLogin,
  onSignup,
  onLogout,
  onStartCheckout,
  onManageBilling,
  onResendVerification,
  onSaveProfile,
}: AuthPanelProps) {
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
  const accountRef = useRef<HTMLElement>(null);
  const displayName = user?.name || user?.email || "";
  const userInitial = displayName.trim().charAt(0).toUpperCase() || "O";
  const isPremium = user?.subscription === "ACTIVE";

  useEffect(() => {
    const preferredTheme = readPreferredTheme();

    setTheme(preferredTheme);
    applyTheme(preferredTheme);
    onDistanceUnitChange(readPreferredDistanceUnit());
  }, [onDistanceUnitChange]);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    function closeAccountMenu() {
      setAccountOpen(false);
      setProfileOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        closeAccountMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAccountMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "signup") {
        await onSignup({ email, password, name, signupCode });
      } else {
        await onLogin({ email, password });
      }

      setPassword("");
      setSignupCode("");
    } finally {
      setSubmitting(false);
    }
  }

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    persistTheme(nextTheme);
    applyTheme(nextTheme);
  }

  function updateUnit(nextUnit: DistanceUnit) {
    persistDistanceUnit(nextUnit);
    onDistanceUnitChange(nextUnit);
  }

  const settingsControls = (
    <div className="account-settings">
      <div className="account-settings__group">
        <span className="account-settings__label">Theme</span>
        <div className="account-settings__switch">
          <button
            type="button"
            className={theme === "light" ? "is-active" : undefined}
            onClick={() => updateTheme("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={theme === "dark" ? "is-active" : undefined}
            onClick={() => updateTheme("dark")}
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
            onClick={() => updateUnit("km")}
          >
            KM
          </button>
          <button
            type="button"
            className={distanceUnit === "mi" ? "is-active" : undefined}
            onClick={() => updateUnit("mi")}
          >
            Miles
          </button>
        </div>
      </div>
    </div>
  );

  if (!user && loading) {
    return (
      <aside
        className="auth-panel auth-panel--signed-in auth-panel--loading auth-panel--compact"
        aria-busy="true"
      >
        <div className="auth-panel__account-trigger auth-panel__account-trigger--loading">
          <span className="auth-panel__avatar auth-panel__avatar--loading" aria-hidden="true" />
          <span className="auth-panel__chevron" aria-hidden="true" />
        </div>
      </aside>
    );
  }

  if (user) {
    const canManageBilling = user.subscription !== "FREE";
    const canUpgrade = user.subscription === "FREE" || user.subscription === "CANCELED";

    return (
      <aside className="auth-panel auth-panel--signed-in auth-panel--compact" ref={accountRef}>
        <button
          className="auth-panel__account-trigger"
          type="button"
          onClick={() => setAccountOpen((isOpen) => !isOpen)}
          aria-expanded={accountOpen}
        >
          <span className="auth-panel__avatar" aria-hidden="true">
            {userInitial}
          </span>
          <span className="auth-panel__chevron" aria-hidden="true" />
        </button>

        {accountOpen ? (
          <div className="auth-panel__account-menu">
            <div className="auth-panel__account-summary">
              <span
              className={
                isPremium
                  ? "auth-panel__avatar auth-panel__avatar--premium"
                  : "auth-panel__avatar"
              }
              aria-hidden="true"
            >
                {userInitial}
              </span>
              <div>
                <span className="auth-panel__meta">Signed in</span>
                <strong>{displayName}</strong>
                <span className="auth-panel__email">{user.email}</span>
                <p>
                  {subscriptionLabels[user.subscription]}{" "}
                  {user.subscription === "ACTIVE" ? <PremiumBadge /> : null}
                </p>
                {!user.emailVerified ? (
                  <p className="auth-panel__verification-status">Email unverified</p>
                ) : null}
              </div>
            </div>
            <p className="auth-panel__defaults">
              Defaults: {levelLabels[user.defaultLevel]} - {user.defaultTargetTime}
            </p>
            {!user.emailVerified ? (
              <div className="auth-panel__verify">
                <span>Email not verified</span>
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
            ) : null}
            {profileOpen ? (
              <form
                className="profile-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSubmitting(true);

                  try {
                    await onSaveProfile({
                      name: profileName,
                      defaultLevel: profileLevel,
                      defaultTargetTime: profileTargetTime,
                    });
                    setProfileOpen(false);
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <label className="field">
                  <span>Email</span>
                  <input value={user.email} readOnly aria-readonly="true" />
                </label>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Runner name"
                  />
                </label>
                <label className="field">
                  <span>Default athlete level</span>
                  <select
                    value={profileLevel}
                    onChange={(event) => setProfileLevel(event.target.value as Level)}
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
                    onChange={(event) => setProfileTargetTime(event.target.value)}
                    inputMode="numeric"
                    placeholder="1:25:00"
                  />
                </label>
                <div className="profile-form__actions">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
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
            ) : (
              <button
                className="button-secondary auth-panel__menu-item"
                type="button"
                onClick={() => {
                  setProfileName(user.name ?? "");
                  setProfileLevel(user.defaultLevel);
                  setProfileTargetTime(user.defaultTargetTime);
                  setProfileOpen(true);
                }}
                disabled={loading}
              >
                Profile settings
              </button>
            )}
            {canUpgrade ? (
              <button
                className="button-secondary auth-panel__menu-item auth-panel__upgrade"
                type="button"
                onClick={onStartCheckout}
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
                className="button-secondary auth-panel__menu-item"
                type="button"
                onClick={onManageBilling}
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
            {settingsControls}
            <button
              className="button-secondary auth-panel__menu-item"
              type="button"
              onClick={() => void onLogout()}
              disabled={loading}
            >
              Log out
            </button>
          </div>
        ) : null}

      </aside>
    );
  }

  return (
    <aside
      className={
        mode
          ? "auth-panel auth-panel--compact auth-panel--open"
          : "auth-panel auth-panel--compact"
      }
      ref={accountRef}
    >
      <button
        className="auth-panel__account-trigger"
        type="button"
        onClick={() => setAccountOpen((isOpen) => !isOpen)}
        aria-expanded={accountOpen}
        aria-label="Account and settings"
      >
        <span className="auth-panel__avatar auth-panel__avatar--guest" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
          </svg>
        </span>
        <span className="auth-panel__chevron" aria-hidden="true" />
      </button>

      {accountOpen ? (
        <div className="auth-panel__account-menu">
          <div className="auth-panel__account-summary auth-panel__account-summary--guest">
            <div>
              <span className="auth-panel__meta">Account</span>
              <strong>Not signed in</strong>
              <span className="auth-panel__email">
                Save reports and unlock premium
              </span>
            </div>
          </div>
          {settingsControls}
          <div className="auth-panel__actions">
            <button
              className="button-secondary auth-panel__menu-item"
              type="button"
              onClick={() => {
                setMode("login");
                setAccountOpen(false);
              }}
            >
              Log in
            </button>
            <button
              className="button-secondary auth-panel__menu-item"
              type="button"
              onClick={() => {
                setMode("signup");
                setAccountOpen(false);
              }}
            >
              Join Ocht
            </button>
          </div>
        </div>
      ) : null}

      {mode ? (
        <div className="auth-panel__popover">
          <div className="auth-panel__popover-header">
            <div>
              <span className="auth-panel__meta">
                {mode === "signup" ? "Create account" : "Welcome back"}
              </span>
              <h2>{mode === "signup" ? "Join Ocht" : "Log in to Ocht"}</h2>
            </div>
            <button
              className="auth-panel__close"
              type="button"
              onClick={() => setMode(null)}
              aria-label="Close account form"
            >
              ×
            </button>
          </div>
          <p className="auth-panel__lead">
            {mode === "signup"
              ? "Save reports, track your targets, and unlock premium race tools."
              : "Access saved reports, billing, and your default race settings."}
          </p>
          <form
            className="auth-panel__form"
            onSubmit={handleSubmit}
          >
            {mode === "signup" ? (
              <label className="field">
                <span>Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Test Runner"
                />
              </label>
            ) : null}
            {mode === "signup" ? (
              <label className="field">
                <span>Beta code</span>
                <input
                  value={signupCode}
                  onChange={(event) => setSignupCode(event.target.value)}
                  placeholder="Invite code"
                />
              </label>
            ) : null}
            <label className="field auth-panel__email-field">
              <span>Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="runner@example.com"
                type="email"
              />
            </label>
            <label className="field auth-panel__password-field">
              <span>Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                type="password"
              />
            </label>
            {mode === "login" ? (
              <Link className="auth-panel__forgot" href="/forgot-password">
                Forgot password?
              </Link>
            ) : null}
            <button type="submit" disabled={submitting || loading}>
              {submitting ? (
                <span className="button-loading">
                  <OctagonSpinner size={18} />
                  Working...
                </span>
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}


