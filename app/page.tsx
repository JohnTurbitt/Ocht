"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ReportHistory } from "@/components/ReportHistory";
import { ReportPanel } from "@/components/ReportPanel";
import { SettingsMenu } from "@/components/SettingsMenu";
import { SplitForm } from "@/components/SplitForm";
import { Toast, ToastMessage } from "@/components/Toast";
import {
  Analysis,
  Level,
  Station,
  StationKey,
  buildAnalysis,
} from "@/lib/analysis";
import {
  SavedReport,
  loadSavedReports,
  saveReports,
} from "@/lib/reportStorage";
import {
  ReportPreset,
  cloneReportPreset,
  defaultCustomReportPreset,
  defaultReportPreset,
  sampleReportPreset,
  tryka500Preset,
  tryka800Preset,
} from "@/lib/reportPresets";
import {
  RaceFormat,
  createCustomStation,
  getRaceFormatStations,
  raceFormatLabels,
} from "@/lib/raceFormats";
import {
  CustomTemplate,
  loadCustomTemplates,
  saveCustomTemplates,
} from "@/lib/customTemplates";
import {
  AuthFormInput,
  AuthUser,
  deleteRemoteReport,
  getCurrentUser,
  loadRemoteReports,
  logIn,
  logOut,
  openBillingPortal,
  ProfileFormInput,
  resendEmailVerification,
  saveRemoteReport,
  signUp,
  startCheckout,
  syncBillingStatus,
  updateProfile,
} from "@/lib/apiClient";
import { trackEvent } from "@/lib/analytics";
import { validateReportInput } from "@/lib/validation";
import type { DistanceUnit } from "@/lib/units";

type ActiveTab = "new" | "history";

const billingRefreshAttempts = 6;
const billingRefreshDelayMs = 1600;
const onboardingDismissedKey = "ocht.onboardingDismissed";
const beginnerGuideDismissedKey = "ocht.beginnerGuideDismissed";

function buildUserDefaultPreset(user: AuthUser | null): ReportPreset {
  return {
    ...defaultReportPreset,
    level: user?.defaultLevel ?? defaultReportPreset.level,
    targetTime: user?.defaultTargetTime ?? defaultReportPreset.targetTime,
  };
}

function buildEmptyPresetForCurrentFormat({
  raceFormat,
  level,
  runCount,
  stationDefinitions,
}: {
  raceFormat: RaceFormat;
  level: Level;
  runCount: number;
  stationDefinitions: Station[];
}): ReportPreset {
  return {
    raceFormat,
    goal: "",
    targetTime: "",
    level,
    runs: Array.from({ length: runCount }, () => ""),
    stationDefinitions:
      raceFormat === "custom"
        ? stationDefinitions.map((station) => ({ ...station }))
        : undefined,
    stationSplits: stationDefinitions.reduce(
      (splits, station) => ({
        ...splits,
        [station.key]: "",
      }),
      {} as Record<StationKey, string>,
    ),
  };
}

const initialEmptyReportPreset = buildEmptyPresetForCurrentFormat({
  raceFormat: defaultReportPreset.raceFormat,
  level: defaultReportPreset.level,
  runCount: defaultReportPreset.runs.length,
  stationDefinitions: getRaceFormatStations(defaultReportPreset.raceFormat),
});

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("new");
  const [raceFormat, setRaceFormat] = useState<RaceFormat>(
    initialEmptyReportPreset.raceFormat,
  );
  const [customStations, setCustomStations] = useState<Station[]>(
    defaultCustomReportPreset.stationDefinitions ?? [],
  );
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [goal, setGoal] = useState(initialEmptyReportPreset.goal);
  const [targetTime, setTargetTime] = useState(initialEmptyReportPreset.targetTime);
  const [level, setLevel] = useState<Level>(initialEmptyReportPreset.level);
  const [runs, setRuns] = useState(initialEmptyReportPreset.runs);
  const [stationSplits, setStationSplits] = useState(
    initialEmptyReportPreset.stationSplits,
  );
  const [runGainPerKm, setRunGainPerKm] = useState("8");
  const [stationGain, setStationGain] = useState("2:30");
  const [transitionGain, setTransitionGain] = useState("0:45");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  const [showHints, setShowHints] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopBottom, setScrollTopBottom] = useState(22);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [beginnerGuideDismissed, setBeginnerGuideDismissed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const activeStationDefinitions =
    raceFormat === "custom"
      ? customStations
      : getRaceFormatStations(raceFormat);

  const preview = useMemo(
    () =>
      buildAnalysis(
        goal,
        targetTime,
        level,
        runs,
        stationSplits,
        activeStationDefinitions,
        raceFormat,
      ),
    [activeStationDefinitions, goal, targetTime, level, raceFormat, runs, stationSplits],
  );

  function updateRun(index: number, value: string) {
    setRuns((current) =>
      current.map((split, splitIndex) => (splitIndex === index ? value : split)),
    );
    clearFieldError(`run-${index}`);
  }

  function addRunSplit() {
    setRuns((current) => [...current, ""]);
  }

  function removeRunSplit(index: number) {
    setRuns((current) =>
      current.length > 1
        ? current.filter((_, splitIndex) => splitIndex !== index)
        : current,
    );
  }

  function updateStation(key: StationKey, value: string) {
    setStationSplits((current) => ({
      ...current,
      [key]: value,
    }));
    clearFieldError(`station-${key}`);
  }

  function replaceCustomStations(nextStations: Station[]) {
    setCustomStations(nextStations);
    setStationSplits((current) =>
      nextStations.reduce(
        (splits, station) => ({
          ...splits,
          [station.key]: current[station.key] ?? "",
        }),
        {} as Record<StationKey, string>,
      ),
    );
  }

  function updateCustomStationLabel(key: StationKey, label: string) {
    replaceCustomStations(
      customStations.map((station) =>
        station.key === key
          ? { ...station, label }
          : station,
      ),
    );
  }

  function addCustomStation() {
    const nextIndex = customStations.length + 1;
    const key = `station-${Date.now()}`;

    replaceCustomStations([
      ...customStations,
      createCustomStation(key, `Station ${nextIndex}`),
    ]);
  }

  function removeCustomStation(key: StationKey) {
    if (customStations.length <= 1) {
      return;
    }

    replaceCustomStations(customStations.filter((station) => station.key !== key));
  }

  function updateTargetTime(value: string) {
    setTargetTime(value);
    clearFieldError("targetTime");
  }

  function clearFieldError(fieldKey: string) {
    setFieldErrors((current) => {
      if (!current[fieldKey]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[fieldKey];
      return nextErrors;
    });
  }

  function applyReportPreset(preset: ReportPreset, toastTitle: string) {
    const nextPreset = cloneReportPreset(preset);

    setRaceFormat(nextPreset.raceFormat);
    setCustomStations(
      nextPreset.stationDefinitions ??
        (nextPreset.raceFormat === "custom"
          ? defaultCustomReportPreset.stationDefinitions ?? []
          : customStations),
    );
    setGoal(nextPreset.goal);
    setTargetTime(nextPreset.targetTime);
    setLevel(nextPreset.level);
    setRuns(nextPreset.runs);
    setStationSplits(nextPreset.stationSplits);
    setAnalysis(null);
    setValidationErrors([]);
    setFieldErrors({});
    setActiveTab("new");
    setToast({
      id: Date.now(),
      title: toastTitle,
      message: "The live preview has been updated.",
      tone: "success",
    });
  }

  function applyRaceFormat(nextRaceFormat: RaceFormat) {
    const formatPresetByFormat: Record<RaceFormat, ReportPreset> = {
      hyrox: buildUserDefaultPreset(user),
      tryka800: tryka800Preset,
      tryka500: tryka500Preset,
      custom: defaultCustomReportPreset,
    };

    applyReportPreset(
      formatPresetByFormat[nextRaceFormat],
      `${raceFormatLabels[nextRaceFormat]} loaded`,
    );
    trackEvent("race_format_selected", {
      race_format: nextRaceFormat,
      signed_in: Boolean(user),
      premium: fullReportUnlocked,
    });
  }

  function activateCustomFormat() {
    if (!fullReportUnlocked) {
      trackEvent("premium_gate_clicked", {
        feature: "custom_format",
        signed_in: Boolean(user),
      });
      setToast({
        id: Date.now(),
        title: "Custom formats are paid",
        message: "Unlock Ocht premium to build and save custom race formats.",
        tone: "error",
      });
      return;
    }

    applyRaceFormat("custom");
  }

  function saveCurrentCustomTemplate() {
    if (raceFormat !== "custom") {
      return;
    }

    const template: CustomTemplate = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name: goal || "Custom race template",
      raceFormat: "custom",
      goal,
      targetTime,
      level,
      runs,
      stationDefinitions: customStations,
      stationSplits,
    };
    const nextTemplates = [template, ...customTemplates].slice(0, 12);

    setCustomTemplates(nextTemplates);
    saveCustomTemplates(nextTemplates);
    setToast({
      id: Date.now(),
      title: "Template saved",
      message: "Your custom race setup is saved on this device.",
      tone: "success",
    });
    trackEvent("custom_template_saved", {
      station_count: customStations.length,
      run_count: runs.length,
    });
  }

  function deleteCustomTemplate(templateId: string) {
    const nextTemplates = customTemplates.filter(
      (template) => template.id !== templateId,
    );

    setCustomTemplates(nextTemplates);
    saveCustomTemplates(nextTemplates);
    setToast({
      id: Date.now(),
      title: "Template deleted",
      message: "The custom race template has been removed.",
      tone: "success",
    });
    trackEvent("custom_template_deleted");
  }

  async function refreshRemoteReports() {
    setReportsLoading(true);

    try {
      setSavedReports(await loadRemoteReports());
    } finally {
      setReportsLoading(false);
    }
  }

  async function pollAccountStatus(expectedPaidAccess?: boolean) {
    setBillingLoading(true);

    for (let attempt = 0; attempt < billingRefreshAttempts; attempt += 1) {
      try {
        const syncedUser = await syncBillingStatus().catch(() => null);

        if (syncedUser) {
          setUser(syncedUser);

          if (
            expectedPaidAccess === undefined ||
            Boolean(syncedUser.subscription === "ACTIVE") === expectedPaidAccess
          ) {
            return;
          }
        }

        const currentUser = await getCurrentUser();

        setUser(currentUser);

        if (
          expectedPaidAccess === undefined ||
          Boolean(currentUser?.subscription === "ACTIVE") === expectedPaidAccess
        ) {
          return;
        }
      } catch {
        break;
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, billingRefreshDelayMs),
      );
    }

    setBillingLoading(false);
  }

  async function handleLogin(input: AuthFormInput) {
    try {
      const authenticatedUser = await logIn(input);

      setUser(authenticatedUser);
      setLevel(authenticatedUser.defaultLevel);
      await refreshRemoteReports();
      setToast({
        id: Date.now(),
        title: "Signed in",
        message: "Your reports will now save to your account.",
        tone: "success",
      });
      trackEvent("login_completed", {
        premium: authenticatedUser.subscription === "ACTIVE",
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Sign in failed",
        message:
          error instanceof Error
            ? error.message
            : "Ocht could not sign you in.",
        tone: "error",
      });
    }
  }

  async function handleSignup(input: AuthFormInput) {
    try {
      const authenticatedUser = await signUp(input);

      setUser(authenticatedUser);
      setLevel(authenticatedUser.defaultLevel);
      await refreshRemoteReports();
      setToast({
        id: Date.now(),
        title: "Account created",
        message: "Your future reports will save to your Ocht account.",
        tone: "success",
      });
      trackEvent("signup_completed");
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Account not created",
        message:
          error instanceof Error
            ? error.message
            : "Ocht could not create this account.",
        tone: "error",
      });
    }
  }

  async function handleLogout() {
    try {
      await logOut();
      setUser(null);
      setSavedReports(loadSavedReports());
      setToast({
        id: Date.now(),
        title: "Signed out",
        message: "Ocht is showing reports saved on this device.",
        tone: "success",
      });
      trackEvent("logout_completed");
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Logout failed",
        message:
          error instanceof Error ? error.message : "Ocht could not log out.",
        tone: "error",
      });
    }
  }

  async function handleStartCheckout() {
    if (!user) {
      setToast({
        id: Date.now(),
        title: "Sign in required",
        message: "Create an account or sign in before unlocking the full report.",
        tone: "error",
      });
      return;
    }

    setBillingLoading(true);
    trackEvent("checkout_started", {
      source: "report_paywall",
    });

    try {
      window.location.href = await startCheckout();
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Checkout not started",
        message:
          error instanceof Error
            ? error.message
            : "Ocht could not open checkout.",
        tone: "error",
      });
      setBillingLoading(false);
      trackEvent("checkout_start_failed");
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    trackEvent("billing_portal_started");

    try {
      window.location.href = await openBillingPortal();
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Billing not opened",
        message:
          error instanceof Error
            ? error.message
            : "Ocht could not open billing settings.",
        tone: "error",
      });
      setBillingLoading(false);
      trackEvent("billing_portal_failed");
    }
  }

  async function handleResendVerification() {
    trackEvent("email_verification_resend_started");

    try {
      await resendEmailVerification();
      setToast({
        id: Date.now(),
        title: "Verification email sent",
        message: "Check your inbox for the Ocht verification link.",
        tone: "success",
      });
      trackEvent("email_verification_resend_completed");
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Verification not sent",
        message:
          error instanceof Error
            ? error.message
            : "Ocht could not send the verification email.",
        tone: "error",
      });
      trackEvent("email_verification_resend_failed");
    }
  }

  function handleCreateOnboardingReport() {
    setActiveTab("new");
    trackEvent("onboarding_create_report_clicked", {
      signed_in: Boolean(user),
    });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".split-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function dismissOnboarding() {
    setOnboardingDismissed(true);
    window.localStorage.setItem(onboardingDismissedKey, "true");
    trackEvent("onboarding_dismissed");
  }

  function dismissBeginnerGuide(eventName = "beginner_guide_dismissed") {
    setBeginnerGuideDismissed(true);
    setDemoOpen(false);
    window.localStorage.setItem(beginnerGuideDismissedKey, "true");
    trackEvent(eventName);
  }

  function loadSampleFromDemo() {
    dismissBeginnerGuide("beginner_demo_sample_loaded");
    applyReportPreset(sampleReportPreset, "Sample race loaded");
  }

  async function handleSaveProfile(input: ProfileFormInput) {
    try {
      const updatedUser = await updateProfile(input);

      setUser(updatedUser);
      setLevel(updatedUser.defaultLevel);
      setTargetTime(updatedUser.defaultTargetTime);
      setToast({
        id: Date.now(),
        title: "Profile saved",
        message: "Your report defaults have been updated.",
        tone: "success",
      });
      trackEvent("profile_saved");
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Profile not saved",
        message:
          error instanceof Error
            ? error.message
            : "Ocht could not save your profile.",
        tone: "error",
      });
      throw error;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateReportInput({
      targetTime,
      runs,
      stationSplits,
      stationDefinitions: activeStationDefinitions,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setFieldErrors(validation.fieldErrors);
      setToast({
        id: Date.now(),
        title: "Report not generated",
        message:
          validation.errors.length === 1
            ? validation.errors[0]
            : `${validation.errors.length} fields need valid times before Ocht can calculate the report.`,
        tone: "error",
      });
      return;
    }

    const generatedAnalysis = buildAnalysis(
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      activeStationDefinitions,
      raceFormat,
    );
    const savedReport: SavedReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      raceFormat,
      goal,
      targetTime,
      level,
      runs,
      stationDefinitions:
        raceFormat === "custom" ? activeStationDefinitions : undefined,
      stationSplits,
      finishSeconds: generatedAnalysis.finishSeconds,
      predictedTargetSeconds: generatedAnalysis.predictedTargetSeconds,
      topLeakLabel: generatedAnalysis.topLeaks[0]?.label ?? "",
    };
    let nextReports = [savedReport, ...savedReports].slice(0, 12);
    let toastMessage = "Your report has been saved on this device.";

    if (user) {
      try {
        const remoteReport = await saveRemoteReport({
          goal,
          targetTime,
          level,
          raceFormat,
          runs,
          stationDefinitions:
            raceFormat === "custom" ? activeStationDefinitions : undefined,
          stationSplits,
        });

        nextReports = [remoteReport, ...savedReports].slice(0, 50);
        toastMessage = "Your report has been saved to your Ocht account.";
      } catch (error) {
        setAnalysis(generatedAnalysis);
        setValidationErrors([]);
        setFieldErrors({});
        setToast({
          id: Date.now(),
          title: "Report generated",
          message:
            error instanceof Error
              ? `${error.message} The report is visible below but was not saved.`
              : "The report is visible below but was not saved to your account.",
          tone: "error",
        });
        window.requestAnimationFrame(() => {
          reportRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
        return;
      }
    } else {
      saveReports(nextReports);
    }

    setAnalysis(generatedAnalysis);
    if (!beginnerGuideDismissed) {
      dismissBeginnerGuide("beginner_guide_completed_by_report");
    }
    setValidationErrors([]);
    setFieldErrors({});
    setToast({
      id: Date.now(),
      title: "Report generated",
      message: toastMessage,
      tone: "success",
    });
    setSavedReports(nextReports);
    setActiveTab("new");
    trackEvent("report_generated", {
      race_format: raceFormat,
      signed_in: Boolean(user),
      premium: fullReportUnlocked,
      saved_remote: Boolean(user),
      run_count: runs.length,
      station_count: activeStationDefinitions.length,
    });
    window.requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function loadReport(report: SavedReport) {
    const loadedAnalysis = buildAnalysis(
      report.goal,
      report.targetTime,
      report.level,
      report.runs,
      report.stationSplits,
      report.stationDefinitions ??
        getRaceFormatStations(report.raceFormat ?? "hyrox"),
      report.raceFormat ?? "hyrox",
    );

    setRaceFormat(report.raceFormat ?? "hyrox");
    if (report.raceFormat === "custom" && report.stationDefinitions) {
      setCustomStations(report.stationDefinitions);
    }
    setGoal(report.goal);
    setTargetTime(report.targetTime);
    setLevel(report.level);
    setRuns(report.runs);
    setStationSplits(report.stationSplits);
    setAnalysis(loadedAnalysis);
    setActiveTab("new");
    trackEvent("saved_report_loaded", {
      race_format: report.raceFormat ?? "hyrox",
      signed_in: Boolean(user),
    });
    window.requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function deleteReport(reportId: string) {
    if (user) {
      try {
        await deleteRemoteReport(reportId);
      } catch (error) {
        setToast({
          id: Date.now(),
          title: "Report not deleted",
          message:
            error instanceof Error
              ? error.message
              : "The server could not delete this report.",
          tone: "error",
        });
        return;
      }
    }

    const nextReports = savedReports.filter((report) => report.id !== reportId);

    setSavedReports(nextReports);

    if (!user) {
      saveReports(nextReports);
    }
    trackEvent("saved_report_deleted", {
      signed_in: Boolean(user),
    });
  }

  const activeAnalysis = analysis ?? preview;
  const fullReportUnlocked = user?.subscription === "ACTIVE";
  const hasReportInput =
    Boolean(analysis) ||
    Boolean(targetTime.trim()) ||
    runs.some((split) => Boolean(split.trim())) ||
    Object.values(stationSplits).some((split) => Boolean(split?.trim()));

  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
    setOnboardingDismissed(
      window.localStorage.getItem(onboardingDismissedKey) === "true",
    );
    setBeginnerGuideDismissed(
      window.localStorage.getItem(beginnerGuideDismissedKey) === "true",
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSession() {
      try {
        const currentUser = await getCurrentUser();

        if (cancelled) {
          return;
        }

        setUser(currentUser);

        if (currentUser) {
          setLevel(currentUser.defaultLevel);
          setSavedReports(await loadRemoteReports());
        } else {
          setSavedReports(loadSavedReports());
        }
      } catch {
        if (!cancelled) {
          setSavedReports(loadSavedReports());
          setToast({
            id: Date.now(),
            title: "Using device storage",
            message: "Ocht could not reach the account API.",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    void loadInitialSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const checkoutStatus = new URLSearchParams(window.location.search).get(
      "checkout",
    );

    if (checkoutStatus === "success") {
      trackEvent("checkout_returned", {
        status: "success",
      });
      setToast({
        id: Date.now(),
        title: "Checkout complete",
        message: "Checking your paid access now.",
        tone: "success",
      });
      void pollAccountStatus(true).finally(() => setBillingLoading(false));
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (checkoutStatus === "cancelled") {
      trackEvent("checkout_returned", {
        status: "cancelled",
      });
      setToast({
        id: Date.now(),
        title: "Checkout cancelled",
        message: "Your report is unchanged.",
        tone: "error",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (checkoutStatus === "billing") {
      trackEvent("billing_portal_returned");
      setToast({
        id: Date.now(),
        title: "Billing updated",
        message: "Refreshing your account status.",
        tone: "success",
      });
      void pollAccountStatus().finally(() => setBillingLoading(false));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    function handleScroll() {
      const footer = document.querySelector<HTMLElement>(".site-footer");
      const footerOverlap = footer
        ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top)
        : 0;

      setShowScrollTop(window.scrollY > 560);
      setScrollTopBottom(footerOverlap > 0 ? footerOverlap + 16 : 22);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 4600);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!demoOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDemoOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [demoOpen]);

  return (
    <main>
      <header className="site-header">
        <img
          className="site-header__logo"
          src="/brand/ocht-logo-wordmark.svg"
          alt="Ocht"
        />
        <div className="site-header__actions">
          <AuthPanel
            user={user}
            loading={authLoading || reportsLoading}
            billingLoading={billingLoading}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            onStartCheckout={handleStartCheckout}
            onManageBilling={handleManageBilling}
            onResendVerification={handleResendVerification}
            onSaveProfile={handleSaveProfile}
          />
          <SettingsMenu
            distanceUnit={distanceUnit}
            onDistanceUnitChange={setDistanceUnit}
          />
        </div>
      </header>

      <section className="intro">
        <div className="intro__copy">
          <h1>Find the time leaks between your reps and runs.</h1>
          <p>
            Add the times from your race or training simulation and Ocht shows
            where you lost time, what is already strong, and what target looks
            realistic next.
          </p>
          {!beginnerGuideDismissed ? (
            <div className="intro-guide" aria-label="How Ocht helps">
              <div>
                <strong>New to hybrid racing?</strong>
                <span>
                  Use Load sample race first, then replace the example times with
                  your own run and station splits.
                </span>
              </div>
              <div className="intro-guide__actions">
                <button
                  type="button"
                  onClick={() => {
                    setDemoOpen(true);
                    trackEvent("beginner_demo_opened");
                  }}
                >
                  Show quick demo
                </button>
                <button
                  type="button"
                  onClick={() => dismissBeginnerGuide()}
                  aria-label="Hide beginner guide"
                >
                  Do not show again
                </button>
              </div>
            </div>
          ) : null}
          <div className="intro-trust" aria-label="Launch trust signals">
            <span>Deterministic formulas</span>
            <span>Coach-friendly exports</span>
            <a href="mailto:support@ocht.app?subject=Ocht%20beta%20feedback">
              Send beta feedback
            </a>
          </div>
          <label className="hint-toggle">
            <input
              checked={showHints}
              onChange={(event) => setShowHints(event.target.checked)}
              type="checkbox"
            />
            <span>Show beginner hints</span>
          </label>
        </div>
      </section>

      {user && !onboardingDismissed ? (
        <OnboardingChecklist
          user={user}
          savedReportCount={savedReports.length}
          billingLoading={billingLoading}
          onCreateReport={handleCreateOnboardingReport}
          onResendVerification={handleResendVerification}
          onStartCheckout={handleStartCheckout}
          onDismiss={dismissOnboarding}
        />
      ) : null}

      <section className="workspace">
        <nav className="tab-bar" aria-label="Report navigation">
          <button
            className={activeTab === "new" ? "tab-bar__tab is-active" : "tab-bar__tab"}
            type="button"
            onClick={() => setActiveTab("new")}
          >
            New report
          </button>
          <button
            className={
              activeTab === "history" ? "tab-bar__tab is-active" : "tab-bar__tab"
            }
            type="button"
            onClick={() => {
              setActiveTab("history");
              trackEvent("history_opened", {
                signed_in: Boolean(user),
                report_count: savedReports.length,
              });
            }}
          >
            Previous reports
            {savedReports.length > 0 ? <span>{savedReports.length}</span> : null}
          </button>
        </nav>

        {activeTab === "new" ? (
          <>
            <SplitForm
              raceFormat={raceFormat}
              fullReportUnlocked={fullReportUnlocked}
              goal={goal}
              targetTime={targetTime}
              level={level}
              runs={runs}
              stationDefinitions={activeStationDefinitions}
              stationSplits={stationSplits}
              errors={validationErrors}
              fieldErrors={fieldErrors}
              customTemplates={customTemplates}
              onRaceFormatChange={applyRaceFormat}
              onCustomFormatClick={activateCustomFormat}
              onAddRun={addRunSplit}
              onRemoveRun={removeRunSplit}
              onAddCustomStation={addCustomStation}
              onRemoveCustomStation={removeCustomStation}
              onCustomStationLabelChange={updateCustomStationLabel}
              onSaveCustomTemplate={saveCurrentCustomTemplate}
              onLoadCustomTemplate={(template) =>
                applyReportPreset(template, "Custom template loaded")
              }
              onDeleteCustomTemplate={deleteCustomTemplate}
              onGoalChange={setGoal}
              onTargetTimeChange={updateTargetTime}
              onLevelChange={setLevel}
              onRunChange={updateRun}
              onStationChange={updateStation}
              onLoadSample={() =>
                applyReportPreset(sampleReportPreset, "Sample race loaded")
              }
              onResetDefaults={() =>
                applyReportPreset(buildUserDefaultPreset(user), "Defaults restored")
              }
              onClearForm={() =>
                applyReportPreset(
                  buildEmptyPresetForCurrentFormat({
                    raceFormat,
                    level,
                    runCount: runs.length,
                    stationDefinitions: activeStationDefinitions,
                  }),
                  "Form cleared",
                )
              }
              onSubmit={handleSubmit}
            />

            <div ref={reportRef} className="report-anchor">
              {hasReportInput ? (
                <ReportPanel
                  analysis={activeAnalysis}
                  distanceUnit={distanceUnit}
                  hasGeneratedReport={Boolean(analysis)}
                  fullReportUnlocked={fullReportUnlocked}
                  canStartCheckout={Boolean(user) && !fullReportUnlocked}
                  billingLoading={billingLoading}
                  showHints={showHints}
                  runGainPerKm={runGainPerKm}
                  stationGain={stationGain}
                  transitionGain={transitionGain}
                  onStartCheckout={handleStartCheckout}
                  onRunGainPerKmChange={setRunGainPerKm}
                  onStationGainChange={setStationGain}
                  onTransitionGainChange={setTransitionGain}
                />
              ) : (
                <div className="empty-state empty-state--report">
                  <h3>No report data yet</h3>
                  <p>
                    Add a target, run splits, and station times to load the math
                    engine, race flow, target path, readiness, strengths, and
                    leaks.
                  </p>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() =>
                      applyReportPreset(sampleReportPreset, "Sample race loaded")
                    }
                  >
                    Load sample race
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <ReportHistory
            reports={savedReports}
            storageLabel={user ? "Saved to your account" : "Saved in this browser"}
            loading={reportsLoading}
            onLoadReport={loadReport}
            onDeleteReport={deleteReport}
          />
        )}
      </section>

      <button
        className={`scroll-top ${showScrollTop ? "scroll-top--visible" : ""}`}
        type="button"
        style={{ bottom: `${scrollTopBottom}px` }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
      >
        Back to top
      </button>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {demoOpen ? (
        <div
          className="demo-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDemoOpen(false);
            }
          }}
        >
          <section
            className="demo-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Hybrid race demo"
          >
            <header className="demo-modal__header">
              <div>
                <p className="eyebrow">Quick demo</p>
                <h2>How to use Ocht</h2>
              </div>
              <button
                type="button"
                onClick={() => setDemoOpen(false)}
                aria-label="Close demo"
              >
                x
              </button>
            </header>
            <div className="demo-modal__steps">
              <article>
                <span>1</span>
                <strong>Enter your goal</strong>
                <p>Pick a target finish time and athlete level.</p>
              </article>
              <article>
                <span>2</span>
                <strong>Add race splits</strong>
                <p>Use run times and station times from a race or simulation.</p>
              </article>
              <article>
                <span>3</span>
                <strong>Read the report</strong>
                <p>Start with target path, strengths, leaks, and next action.</p>
              </article>
            </div>
            <div className="demo-modal__example" aria-label="Example split input">
              <div>
                <span>Target</span>
                <strong>1:20:00</strong>
              </div>
              <div>
                <span>Run 1</span>
                <strong>4:55</strong>
              </div>
              <div>
                <span>Sled push</span>
                <strong>5:45</strong>
              </div>
              <div>
                <span>Output</span>
                <strong>Find leaks</strong>
              </div>
            </div>
            <div className="demo-modal__actions">
              <button type="button" onClick={loadSampleFromDemo}>
                Load sample race
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => dismissBeginnerGuide("beginner_demo_enter_own")}
              >
                I will enter my own
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
