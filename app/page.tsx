"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { Hint } from "@/components/Hint";
import { ReportHistory } from "@/components/ReportHistory";
import { ReportPanel } from "@/components/ReportPanel";
import { SplitForm } from "@/components/SplitForm";
import { Toast, ToastMessage } from "@/components/Toast";
import {
  Analysis,
  Level,
  Station,
  StationKey,
  buildAnalysis,
  formatTime,
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
  emptyReportPreset,
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
  saveRemoteReport,
  signUp,
  startCheckout,
  updateProfile,
} from "@/lib/apiClient";
import { validateReportInput } from "@/lib/validation";

type ActiveTab = "new" | "history";

const billingRefreshAttempts = 6;
const billingRefreshDelayMs = 1600;

function buildUserDefaultPreset(user: AuthUser | null): ReportPreset {
  return {
    ...defaultReportPreset,
    level: user?.defaultLevel ?? defaultReportPreset.level,
    targetTime: user?.defaultTargetTime ?? defaultReportPreset.targetTime,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("new");
  const [raceFormat, setRaceFormat] = useState<RaceFormat>(
    defaultReportPreset.raceFormat,
  );
  const [customStations, setCustomStations] = useState<Station[]>(
    defaultCustomReportPreset.stationDefinitions ?? [],
  );
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [goal, setGoal] = useState(defaultReportPreset.goal);
  const [targetTime, setTargetTime] = useState(defaultReportPreset.targetTime);
  const [level, setLevel] = useState<Level>(defaultReportPreset.level);
  const [runs, setRuns] = useState(defaultReportPreset.runs);
  const [stationSplits, setStationSplits] = useState(
    defaultReportPreset.stationSplits,
  );
  const [runGainPerKm, setRunGainPerKm] = useState("8");
  const [stationGain, setStationGain] = useState("2:30");
  const [transitionGain, setTransitionGain] = useState("0:45");
  const [showHints, setShowHints] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopBottom, setScrollTopBottom] = useState(22);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
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
  }

  function activateCustomFormat() {
    if (!fullReportUnlocked) {
      setToast({
        id: Date.now(),
        title: "Custom formats are paid",
        message: "Unlock RepRun premium to build and save custom race formats.",
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
      setTargetTime(authenticatedUser.defaultTargetTime);
      await refreshRemoteReports();
      setToast({
        id: Date.now(),
        title: "Signed in",
        message: "Your reports will now save to your account.",
        tone: "success",
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Sign in failed",
        message:
          error instanceof Error
            ? error.message
            : "RepRun could not sign you in.",
        tone: "error",
      });
    }
  }

  async function handleSignup(input: AuthFormInput) {
    try {
      const authenticatedUser = await signUp(input);

      setUser(authenticatedUser);
      setLevel(authenticatedUser.defaultLevel);
      setTargetTime(authenticatedUser.defaultTargetTime);
      await refreshRemoteReports();
      setToast({
        id: Date.now(),
        title: "Account created",
        message: "Your future reports will save to your RepRun account.",
        tone: "success",
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Account not created",
        message:
          error instanceof Error
            ? error.message
            : "RepRun could not create this account.",
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
        message: "RepRun is showing reports saved on this device.",
        tone: "success",
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Logout failed",
        message:
          error instanceof Error ? error.message : "RepRun could not log out.",
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

    try {
      window.location.href = await startCheckout();
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Checkout not started",
        message:
          error instanceof Error
            ? error.message
            : "RepRun could not open checkout.",
        tone: "error",
      });
      setBillingLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);

    try {
      window.location.href = await openBillingPortal();
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Billing not opened",
        message:
          error instanceof Error
            ? error.message
            : "RepRun could not open billing settings.",
        tone: "error",
      });
      setBillingLoading(false);
    }
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
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Profile not saved",
        message:
          error instanceof Error
            ? error.message
            : "RepRun could not save your profile.",
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
            : `${validation.errors.length} fields need valid times before RepRun can calculate the report.`,
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
        toastMessage = "Your report has been saved to your RepRun account.";
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
  }

  const activeAnalysis = analysis ?? preview;
  const fullReportUnlocked = user?.subscription === "ACTIVE";

  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
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
          setTargetTime(currentUser.defaultTargetTime);
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
            message: "RepRun could not reach the account API.",
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
      setToast({
        id: Date.now(),
        title: "Checkout cancelled",
        message: "Your report is unchanged.",
        tone: "error",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (checkoutStatus === "billing") {
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

  return (
    <main>
      <section className="intro">
        <header className="site-header">
          <img
            className="site-header__logo"
            src="/brand/reprun-logo-09-wordmark.svg"
            alt="RepRun"
          />
          <AuthPanel
            user={user}
            loading={authLoading || reportsLoading}
            billingLoading={billingLoading}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            onManageBilling={handleManageBilling}
            onSaveProfile={handleSaveProfile}
          />
        </header>
        <div className="intro__copy">
          <h1>Find the time leaks between your reps and runs.</h1>
          <p>
            Enter your splits to get a deterministic race breakdown, ranked weak
            points, and a realistic next target without AI guesswork.
          </p>
          <label className="hint-toggle">
            <input
              checked={showHints}
              onChange={(event) => setShowHints(event.target.checked)}
              type="checkbox"
            />
            <span>Show beginner hints</span>
          </label>
        </div>
        <div className="quick-stats" aria-label="Current split summary">
          <div>
            <span>Projected finish</span>
            <strong>{formatTime(activeAnalysis.finishSeconds)}</strong>
          </div>
          <div>
            <span>
              <Hint enabled={showHints} hint="recoverable" term="Recoverable" />{" "}
              time
            </span>
            <strong>{formatTime(activeAnalysis.recoverableSeconds)}</strong>
          </div>
          <div>
            <span>Next target</span>
            <strong>{formatTime(activeAnalysis.predictedTargetSeconds)}</strong>
          </div>
        </div>
      </section>

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
            onClick={() => setActiveTab("history")}
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
                  { ...emptyReportPreset, raceFormat },
                  "Form cleared",
                )
              }
              onSubmit={handleSubmit}
            />

            <div ref={reportRef} className="report-anchor">
              <ReportPanel
                analysis={activeAnalysis}
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
    </main>
  );
}
