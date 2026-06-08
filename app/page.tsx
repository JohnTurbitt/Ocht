"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppLaunchSplash } from "@/components/AppLaunchSplash";
import { AuthPanel } from "@/components/AuthPanel";
import { EventsList } from "@/components/EventsList";
import { OchtShield } from "@/components/OchtShield";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ReportGenerationOverlay } from "@/components/ReportGenerationOverlay";
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
  const [runGainPerKm, setRunGainPerKm] = useState("8");
  const [stationGain, setStationGain] = useState("2:30");
  const [transitionGain, setTransitionGain] = useState("0:45");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");
  const [showHints, setShowHints] = useState(true);
  const [hasGeneratedReportEver, setHasGeneratedReportEver] = useState(false);
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
  const [eventsSheetOpen, setEventsSheetOpen] = useState(false);
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

  function selectTab(tab: ActiveTab) {
    setActiveTab(tab);
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
        <Link className="site-header__brand" href="/" aria-label="Ocht home">
          <OchtShield className="site-header__shield" size={26} />
          <span className="site-header__wordmark">
            ocht<em>.</em>
          </span>
        </Link>
        <nav className="site-header__nav" aria-label="Race calendar">
          <UpcomingEventsMenu />
        </nav>
        <div className="site-header__actions">
          <AuthPanel
            user={user}
            loading={authLoading || reportsLoading}
            billingLoading={billingLoading}
            distanceUnit={distanceUnit}
            onDistanceUnitChange={setDistanceUnit}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            onStartCheckout={handleStartCheckout}
            onManageBilling={handleManageBilling}
            onResendVerification={handleResendVerification}
            onSaveProfile={handleSaveProfile}
          />
        </div>
      </header>

      <section className="intro hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">Hybrid race intelligence</p>
          <h1>Find the time leaks between your reps and runs.</h1>
          <p className="hero__lead">
            Add the times from your race or training simulation and Ocht shows
            where you lost time, what is already strong, and what target looks
            realistic next.
          </p>
          <div className="hero__actions">
            <button
              className="btn btn--primary btn--cut btn--lg"
              type="button"
              onClick={handleCreateOnboardingReport}
            >
              Analyse a race
            </button>
            <button
              className="btn btn--secondary btn--lg"
              type="button"
              onClick={() =>
                applyReportPreset(sampleReportPreset, "Sample race loaded")
              }
            >
              Load sample race
            </button>
          </div>
          <ul className="hero__trust" aria-label="What you get">
            <li>Deterministic formulas</li>
            <li>Coach-friendly exports</li>
            <li>Free core report</li>
          </ul>
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
                  className="btn btn--secondary btn--sm"
                  type="button"
                  onClick={() => {
                    setDemoOpen(true);
                    trackEvent("beginner_demo_opened");
                  }}
                >
                  Show quick demo
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  onClick={() => dismissBeginnerGuide()}
                  aria-label="Hide beginner guide"
                >
                  Do not show again
                </button>
              </div>
            </div>
          ) : null}
          <label className="hint-toggle">
            <input
              checked={showHints}
              onChange={(event) => setShowHints(event.target.checked)}
              type="checkbox"
            />
            <span>Show beginner hints</span>
          </label>
        </div>
        <aside className="hero__motif" aria-hidden="true">
          <div className="hero__ring">
            <svg className="hero__octo" viewBox="0 0 110 110" fill="none">
              <polygon
                className="hero__octo-line"
                points="55,5 90,18 105,55 90,92 55,105 20,92 5,55 20,18"
              />
              <g className="hero__octo-dots">
                <circle cx="55" cy="5" r="3" />
                <circle cx="90" cy="18" r="3" />
                <circle cx="105" cy="55" r="3" />
                <circle cx="90" cy="92" r="3" />
                <circle cx="55" cy="105" r="3" />
                <circle cx="20" cy="92" r="3" />
                <circle cx="5" cy="55" r="3" />
                <circle cx="20" cy="18" r="3" />
              </g>
            </svg>
            <OchtShield className="hero__shield" size={68} />
          </div>
          <p className="hero__identity">8 stations · 8 runs · 1 race</p>
        </aside>
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
            <span className="tab-bar__label">Previous reports</span>
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
                  trainingContext={trainingContext}
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
        ) : activeTab === "history" ? (
          <ReportHistory
            reports={savedReports}
            storageLabel={user ? "Saved to your account" : "Saved in this browser"}
            loading={reportsLoading}
            onLoadReport={loadReport}
            onDeleteReport={deleteReport}
          />
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
        />
      ) : null}
      {generatingReport ? <ReportGenerationOverlay /> : null}
      {eventsSheetOpen ? (
        <div
          className="events-sheet"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEventsSheetOpen(false);
            }
          }}
        >
          <section
            className="events-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Upcoming races"
          >
            <button
              className="events-sheet__close"
              type="button"
              onClick={() => setEventsSheetOpen(false)}
              aria-label="Close events"
            >
              ×
            </button>
            <EventsList />
          </section>
        </div>
      ) : null}

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
                className="modal-close"
                type="button"
                onClick={() => setDemoOpen(false)}
                aria-label="Close demo"
              >
                ×
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
