import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthFormInput, AuthUser } from "@/lib/apiClient";
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

type AuthPanelProps = {
  user: AuthUser | null;
  loading: boolean;
  distanceUnit: DistanceUnit;
  onDistanceUnitChange: (unit: DistanceUnit) => void;
  avatarColor: string;
  avatarIcon: string;
  onLogin: (input: AuthFormInput) => Promise<void>;
  onSignup: (input: AuthFormInput) => Promise<void>;
  onLogout: () => Promise<void>;
  initialMode?: AuthMode | null;
};

export type AuthMode = "login" | "signup";

export function AuthPanel({
  user,
  loading,
  distanceUnit,
  onDistanceUnitChange,
  avatarColor,
  avatarIcon,
  onLogin,
  onSignup,
  onLogout,
  initialMode = null,
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode | null>(initialMode);
  const [theme, setTheme] = useState<Theme>("light");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
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
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    function closeAccountMenu() {
      setAccountOpen(false);
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
    return (
      <aside className="auth-panel auth-panel--signed-in auth-panel--compact">
        <Link
          href="/settings"
          className="auth-panel__account-trigger"
          aria-label="Account settings"
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
        </Link>
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
              ? "Save reports, track your targets and unlock premium race tools."
              : "Access saved reports, billing and your default race settings."}
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


