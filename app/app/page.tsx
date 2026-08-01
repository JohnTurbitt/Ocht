"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppLaunchSplash } from "@/components/AppLaunchSplash";
import { AuthPanel, type AuthMode } from "@/components/AuthPanel";
import { DemoModal } from "@/components/DemoModal";
import { DevModeBadge } from "@/components/DevModeBadge";
import { EventsSheet } from "@/components/EventsSheet";
import { Hero } from "@/components/Hero";
import { OchtShield } from "@/components/OchtShield";
import { PersonalRecords } from "@/components/PersonalRecords";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import {
  persistAvatarColor,
  persistAvatarIcon,
  readAvatarColor,
  readAvatarIcon,
} from "@/lib/preferences";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ReportGenerationOverlay } from "@/components/ReportGenerationOverlay";
import { ResultsReveal } from "@/components/ResultsReveal";
import { ReportHistory } from "@/components/ReportHistory";
import { ReportPanel } from "@/components/ReportPanel";
import { SplitForm } from "@/components/SplitForm";
import { Toast, ToastMessage } from "@/components/Toast";
import { UpcomingEventsMenu } from "@/components/UpcomingEventsMenu";
import {
  Analysis,
  Level,
  Station,
  StationKey,
  buildAnalysis,
  tierFor,
} from "@/lib/analysis";
import { calculateRaceReadiness } from "@/lib/readiness";
import {
  SavedReport,
  loadSavedReports,
  saveReports,
} from "@/lib/reportStorage";
import { groupKeyForReport, isNewPersonalBest } from "@/lib/progress";
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
  deleteAccount,
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
import {
  TrainingContext,
  emptyTrainingContext,
  hasTrainingContext,
} from "@/lib/trainingContext";
import { validateReportInput } from "@/lib/validation";
import type { DistanceUnit } from "@/lib/units";

type ActiveTab = "new" | "history" | "compare";

const billingRefreshAttempts = 6;
const billingRefreshDelayMs = 1600;
const onboardingDismissedKey = "ocht.onboardingDismissed";
const beginnerGuideDismissedKey = "ocht.beginnerGuideDismissed";
const hasGeneratedReportKey = "ocht.hasGeneratedReport";

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
  const [officialFinishTime, setOfficialFinishTime] = useState("");
  const [level, setLevel] = useState<Level>(initialEmptyReportPreset.level);
  const [runs, setRuns] = useState(initialEmptyReportPreset.runs);
  const [stationSplits, setStationSplits] = useState(
    initialEmptyReportPreset.stationSplits,
  );
  const [trainingContext, setTrainingContext] =
    useState<TrainingContext>(emptyTrainingContext);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  const [showHints, setShowHints] = useState(true);
  const [hasGeneratedReportEver, setHasGeneratedReportEver] = useState(false);
  const [avatarColor, setAvatarColor] = useState("#c8ff2e");
  const [avatarIcon, setAvatarIcon] = useState("initial");
  const [authModeParam, setAuthModeParam] = useState<AuthMode | null>(null);
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
  const [showSplash, setShowSplash] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showResultsReveal, setShowResultsReveal] = useState(false);
  const [revealIsPb, setRevealIsPb] = useState(false);
  const [eventsSheetOpen, setEventsSheetOpen] = useState(false);
  const [viewingSavedReport, setViewingSavedReport] = useState(false);
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
        officialFinishTime,
      ),
    [
      activeStationDefinitions,
      goal,
      targetTime,
      officialFinishTime,
      level,
      raceFormat,
      runs,
      stationSplits,
    ],
  );

  const latestScore = useMemo(() => {
    if (savedReports.length === 0) return undefined;
    const r = savedReports[0];
    try {
      const a = buildAnalysis(
        r.goal,
        r.targetTime,
        r.level,
        r.runs,
        r.stationSplits,
        r.stationDefinitions ?? getRaceFormatStations(r.raceFormat ?? "hyrox"),
        r.raceFormat ?? "hyrox",
        r.officialFinishTime ?? "",
      );
      return calculateRaceReadiness(a).overall;
    } catch {
      return undefined;
    }
  }, [savedReports]);

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

  function updateTrainingContext(field: keyof TrainingContext, value: string) {
    setTrainingContext((current) => ({
      ...current,
      [field]: value,
    }));
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
    setOfficialFinishTime("");
    setLevel(nextPreset.level);
    setRuns(nextPreset.runs);
    setStationSplits(nextPreset.stationSplits);
    setAnalysis(null);
    setViewingSavedReport(false);
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

  async function pollAccountStatus(expectedPaidAccess?: boolean): Promise<boolean> {
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
            return true;
          }
        }

        const currentUser = await getCurrentUser();

        setUser(currentUser);

        if (
          expectedPaidAccess === undefined ||
          Boolean(currentUser?.subscription === "ACTIVE") === expectedPaidAccess
        ) {
          return true;
        }
      } catch {
        break;
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, billingRefreshDelayMs),
      );
    }

    return false;
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

  async function handleDeleteAccount() {
    try {
      await deleteAccount();
      setUser(null);
      setSavedReports(loadSavedReports());
      setToast({
        id: Date.now(),
        title: "Account deleted",
        message: "Your Ocht account and saved reports have been removed.",
        tone: "success",
      });
      trackEvent("account_deleted");
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Account not deleted",
        message:
          error instanceof Error
            ? error.message
            : "Ocht could not delete your account.",
        tone: "error",
      });
      throw error;
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

  function selectTab(tab: ActiveTab) {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };

    if (doc.startViewTransition) {
      doc.startViewTransition(() => setActiveTab(tab));
    } else {
      setActiveTab(tab);
    }

    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".workspace")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
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

    setGeneratingReport(true);
    // Hold the generation overlay long enough to read as intentional, even
    // though the math is synchronous and any remote save is usually fast.
    const minimumHold = new Promise<void>((resolve) =>
      window.setTimeout(resolve, 1700),
    );

    const generatedAnalysis = buildAnalysis(
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      activeStationDefinitions,
      raceFormat,
      officialFinishTime,
    );
    const savedReport: SavedReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      raceFormat,
      goal,
      targetTime,
      officialFinishTime: officialFinishTime || undefined,
      level,
      runs,
      stationDefinitions:
        raceFormat === "custom" ? activeStationDefinitions : undefined,
      stationSplits,
      trainingContext: hasTrainingContext(trainingContext)
        ? trainingContext
        : undefined,
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
          trainingContext: hasTrainingContext(trainingContext)
            ? trainingContext
            : undefined,
        });

        nextReports = [remoteReport, ...savedReports];
        toastMessage = "Your report has been saved to your Ocht account.";
      } catch (error) {
        await minimumHold;
        setGeneratingReport(false);
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

    await minimumHold;
    setGeneratingReport(false);
    setAnalysis(generatedAnalysis);
    setViewingSavedReport(false);
    setRevealIsPb(
      isNewPersonalBest(
        savedReports,
        generatedAnalysis.finishSeconds,
        groupKeyForReport(savedReport),
      ),
    );
    setShowResultsReveal(true);
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
    if (!hasGeneratedReportEver) {
      window.localStorage.setItem(hasGeneratedReportKey, "true");
      setHasGeneratedReportEver(true);
    }
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
      report.officialFinishTime ?? "",
    );

    setRaceFormat(report.raceFormat ?? "hyrox");
    if (report.raceFormat === "custom" && report.stationDefinitions) {
      setCustomStations(report.stationDefinitions);
    }
    setGoal(report.goal);
    setTargetTime(report.targetTime);
    setOfficialFinishTime(report.officialFinishTime ?? "");
    setLevel(report.level);
    setRuns(report.runs);
    setStationSplits(report.stationSplits);
    setTrainingContext(report.trainingContext ?? emptyTrainingContext);
    setAnalysis(loadedAnalysis);
    setViewingSavedReport(true);
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
  const isExperiencedUser = hasGeneratedReportEver || savedReports.length > 0;
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

    const experienced =
      window.localStorage.getItem(hasGeneratedReportKey) === "true";

    if (experienced) {
      setHasGeneratedReportEver(true);
      // Returning users start with the beginner hints collapsed.
      setShowHints(false);
    }

    setAvatarColor(readAvatarColor());
    setAvatarIcon(readAvatarIcon());

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "history" || tabParam === "compare") {
      setActiveTab(tabParam);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sampleParam = params.get("sample");
    const authParam = params.get("auth");

    if (sampleParam === "1") {
      applyReportPreset(sampleReportPreset, "Sample race loaded");
    }

    if (authParam === "login" || authParam === "signup") {
      setAuthModeParam(authParam);
    }

    if (sampleParam || authParam) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function updateAvatarColor(color: string) {
    setAvatarColor(color);
    persistAvatarColor(color);
  }

  function updateAvatarIcon(icon: string) {
    setAvatarIcon(icon);
    persistAvatarIcon(icon);
  }

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
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");
    const returnToParam = params.get("return_to");
    // The server already validates return_to before embedding it in the Stripe
    // redirect URL, but re-check here too in case someone hand-edits the address bar.
    const returnTo =
      returnToParam &&
      returnToParam.startsWith("/") &&
      !returnToParam.startsWith("//")
        ? returnToParam
        : null;

    function goToReturnDestination() {
      if (returnTo) {
        window.location.href = returnTo;
      }
    }

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
      void pollAccountStatus(true)
        .then((confirmed) => {
          if (confirmed) {
            setToast({
              id: Date.now(),
              title: "Premium unlocked",
              message: "Your paid access is active.",
              tone: "success",
            });
          } else {
            setToast({
              id: Date.now(),
              title: "Still confirming your subscription",
              message:
                "Stripe is taking a bit longer than usual. Refresh in a moment if this doesn't update on its own.",
              tone: "error",
            });
          }
        })
        .finally(() => {
          setBillingLoading(false);
          goToReturnDestination();
        });
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
      goToReturnDestination();
    }

    if (checkoutStatus === "billing") {
      trackEvent("billing_portal_returned");
      setToast({
        id: Date.now(),
        title: "Billing updated",
        message: "Refreshing your account status.",
        tone: "success",
      });
      void pollAccountStatus()
        .then((confirmed) => {
          if (!confirmed) {
            setToast({
              id: Date.now(),
              title: "Still refreshing your account",
              message:
                "This is taking longer than usual. Refresh in a moment if this doesn't update on its own.",
              tone: "error",
            });
          }
        })
        .finally(() => {
          setBillingLoading(false);
          goToReturnDestination();
        });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const stravaStatus = new URLSearchParams(window.location.search).get("strava");

    if (stravaStatus === "connected") {
      setToast({
        id: Date.now(),
        title: "Connected to Strava",
        message: "Your training data is syncing in the background.",
        tone: "success",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (stravaStatus === "error") {
      setToast({
        id: Date.now(),
        title: "Strava connection failed",
        message: "Something went wrong. Please try connecting again.",
        tone: "error",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (stravaStatus === "insufficient_scope") {
      setToast({
        id: Date.now(),
        title: "Strava permissions required",
        message: "Please grant activity access when connecting Strava.",
        tone: "error",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadStravaProfile() {
      try {
        const res = await fetch("/api/strava/profile");
        if (!res.ok) return;
        const data = (await res.json()) as {
          profile: {
            runsPerWeek: number | null;
            weeklyDistanceKm: number | null;
            longestRunKm: number | null;
            hardRunsPerWeek: number | null;
            restDaysPerWeek: number | null;
          } | null;
        };
        if (!data.profile) return;

        setStravaConnected(true);
        const p = data.profile;
        setTrainingContext((current) => {
          if (hasTrainingContext(current)) return current;
          return {
            ...current,
            runsPerWeek: p.runsPerWeek != null ? String(Math.round(p.runsPerWeek * 10) / 10) : current.runsPerWeek,
            weeklyDistanceKm: p.weeklyDistanceKm != null ? String(p.weeklyDistanceKm) : current.weeklyDistanceKm,
            longestRunKm: p.longestRunKm != null ? String(p.longestRunKm) : current.longestRunKm,
            hardRunsPerWeek: p.hardRunsPerWeek != null ? String(Math.round(p.hardRunsPerWeek * 10) / 10) : current.hardRunsPerWeek,
            restDaysPerWeek: p.restDaysPerWeek != null ? String(p.restDaysPerWeek) : current.restDaysPerWeek,
          };
        });
      } catch {
        // Strava profile is optional — ignore failures silently
      }
    }

    void loadStravaProfile();
  }, [user]);

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

  useEffect(() => {
    if (!eventsSheetOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEventsSheetOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [eventsSheetOpen]);

  return (
    <main>
      <header className="site-header">
        <Link className="site-header__brand" href="/">
          <OchtShield className="site-header__shield" size={26} />
          <span className="site-header__wordmark">
            ocht<em>.</em>
          </span>
        </Link>
        {process.env.NODE_ENV !== "production" && <DevModeBadge />}
        <nav className="site-header__nav" aria-label="Race calendar">
          <UpcomingEventsMenu />
        </nav>
        <div className="site-header__actions">
          <AuthPanel
            user={user}
            loading={authLoading || reportsLoading}
            distanceUnit={distanceUnit}
            onDistanceUnitChange={setDistanceUnit}
            avatarColor={avatarColor}
            avatarIcon={avatarIcon}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            initialMode={authModeParam}
          />
        </div>
      </header>

      <Hero
        showBeginnerGuide={!beginnerGuideDismissed}
        showHints={showHints}
        onAnalyse={handleCreateOnboardingReport}
        onLoadSample={() =>
          applyReportPreset(sampleReportPreset, "Sample race loaded")
        }
        onShowDemo={() => {
          setDemoOpen(true);
          trackEvent("beginner_demo_opened");
        }}
        onDismissGuide={() => dismissBeginnerGuide()}
        onShowHintsChange={setShowHints}
      />

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
            onClick={() => selectTab("new")}
          >
            <svg
              className="tab-bar__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span className="tab-bar__label">New report</span>
          </button>
          <button
            className={
              activeTab === "history" ? "tab-bar__tab is-active" : "tab-bar__tab"
            }
            type="button"
            onClick={() => {
              selectTab("history");
              trackEvent("history_opened", {
                signed_in: Boolean(user),
                report_count: savedReports.length,
              });
            }}
          >
            <svg
              className="tab-bar__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3h18v18H3z" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            <span className="tab-bar__label">Progress</span>
            {savedReports.length > 0 ? <span>{savedReports.length}</span> : null}
          </button>
          <button
            className={
              activeTab === "compare" ? "tab-bar__tab is-active" : "tab-bar__tab"
            }
            type="button"
            onClick={() => {
              selectTab("compare");
              trackEvent("compare_reports_opened", {
                signed_in: Boolean(user),
                report_count: savedReports.length,
              });
            }}
          >
            <svg
              className="tab-bar__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 20V10M10 20V4M16 20v-7M20 20H2" />
            </svg>
            <span className="tab-bar__label">Compare</span>
          </button>
          <button
            className="tab-bar__tab tab-bar__tab--events"
            type="button"
            onClick={() => setEventsSheetOpen(true)}
          >
            <svg
              className="tab-bar__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
            <span className="tab-bar__label">Events</span>
          </button>
        </nav>

        {activeTab === "new" ? (
          <>
            {viewingSavedReport ? null : (
            <SplitForm
              raceFormat={raceFormat}
              fullReportUnlocked={fullReportUnlocked}
              showStartGuide={!isExperiencedUser}
              onShowGuide={() => {
                setDemoOpen(true);
                trackEvent("beginner_demo_opened");
              }}
              goal={goal}
              targetTime={targetTime}
              officialFinishTime={officialFinishTime}
              level={level}
              runs={runs}
              stationDefinitions={activeStationDefinitions}
              stationSplits={stationSplits}
              trainingContext={trainingContext}
              stravaConnected={stravaConnected}
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
              onOfficialFinishChange={setOfficialFinishTime}
              onLevelChange={setLevel}
              onRunChange={updateRun}
              onStationChange={updateStation}
              onTrainingContextChange={updateTrainingContext}
              onLoadSample={() =>
                applyReportPreset(sampleReportPreset, "Sample race loaded")
              }
              onResetDefaults={() =>
                applyReportPreset(buildUserDefaultPreset(user), "Defaults restored")
              }
              onClearForm={() => {
                setTrainingContext(emptyTrainingContext);
                applyReportPreset(
                  buildEmptyPresetForCurrentFormat({
                    raceFormat,
                    level,
                    runCount: runs.length,
                    stationDefinitions: activeStationDefinitions,
                  }),
                  "Form cleared",
                );
              }}
              onSubmit={handleSubmit}
            />
            )}

            {viewingSavedReport ? (
              <div className="saved-report-bar">
                <div>
                  <p className="eyebrow">Saved report</p>
                  <strong>You are viewing a past report</strong>
                </div>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => {
                    setViewingSavedReport(false);
                    window.requestAnimationFrame(() => {
                      document
                        .querySelector<HTMLElement>(".split-form")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                >
                  Edit splits
                </button>
              </div>
            ) : null}

            <div ref={reportRef} className="report-anchor">
              {hasReportInput ? (
                <ReportPanel
                  analysis={activeAnalysis}
                  distanceUnit={distanceUnit}
                  athleteName={user?.name ?? ""}
                  avatarColor={avatarColor}
                  avatarIcon={avatarIcon}
                  hasGeneratedReport={Boolean(analysis)}
                  fullReportUnlocked={fullReportUnlocked}
                  canStartCheckout={Boolean(user) && !fullReportUnlocked}
                  billingLoading={billingLoading}
                  showHints={showHints}
                  savedReports={savedReports}
                  onStartCheckout={handleStartCheckout}
                  trainingContext={trainingContext}
                />
              ) : (
                <div className="empty-state empty-state--report">
                  <span className="empty-state__mark" aria-hidden="true">
                    <OchtShield size={40} />
                  </span>
                  <h3>Your race file is empty</h3>
                  <p>
                    Add a target, run splits, and station times to unlock the math
                    engine, race flow, archetype, roxzone, readiness, and leaks.
                  </p>
                  <button
                    className="btn btn--primary btn--cut"
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
        ) : activeTab === "history" ? (
          <>
            <ProgressDashboard reports={savedReports} />
            <PersonalRecords reports={savedReports} />
            <ReportHistory
              reports={savedReports}
              storageLabel={
                user ? "Saved to your account" : "Saved in this browser"
              }
              loading={reportsLoading}
              onLoadReport={loadReport}
              onDeleteReport={deleteReport}
            />
          </>
        ) : (
          <ReportHistory
            reports={savedReports}
            storageLabel={user ? "Saved to your account" : "Saved in this browser"}
            loading={reportsLoading}
            showComparison
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

      {showSplash ? (
        <AppLaunchSplash
          ready={!authLoading}
          onDone={() => setShowSplash(false)}
          score={latestScore}
          tierLabel={latestScore !== undefined ? tierFor(latestScore).label : undefined}
        />
      ) : null}
      {generatingReport ? <ReportGenerationOverlay /> : null}
      {showResultsReveal && analysis ? (
        <ResultsReveal
          analysis={analysis}
          isNewPB={revealIsPb}
          onClose={() => {
            setShowResultsReveal(false);
            window.requestAnimationFrame(() => {
              reportRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            });
          }}
          onViewArchetype={() => {
            setShowResultsReveal(false);
            window.requestAnimationFrame(() => {
              document.getElementById("report-profile")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            });
          }}
        />
      ) : null}
      {eventsSheetOpen ? (
        <EventsSheet onClose={() => setEventsSheetOpen(false)} />
      ) : null}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {demoOpen ? (
        <DemoModal
          onClose={() => setDemoOpen(false)}
          onLoadSample={loadSampleFromDemo}
          onEnterOwn={() => dismissBeginnerGuide("beginner_demo_enter_own")}
        />
      ) : null}
    </main>
  );
}
