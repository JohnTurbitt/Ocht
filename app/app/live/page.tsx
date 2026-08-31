"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveSessionSetup } from "@/components/LiveSessionSetup";
import { LiveSessionTracker } from "@/components/LiveSessionTracker";
import { ReportGenerationOverlay } from "@/components/ReportGenerationOverlay";
import { ResultsReveal } from "@/components/ResultsReveal";
import {
  LiveSessionDraft,
  LiveSessionFormat,
  clearDraft,
  loadDraft,
} from "@/lib/liveSession";
import { Level } from "@/lib/analysis";
import { getRaceFormatStations } from "@/lib/raceFormats";
import { AuthUser, getCurrentUser, loadRemoteReports } from "@/lib/apiClient";
import { SavedReport, loadSavedReports } from "@/lib/reportStorage";
import { emptyTrainingContext } from "@/lib/trainingContext";
import { Toast, ToastMessage } from "@/components/Toast";
import { useReportGeneration } from "@/lib/hooks/useReportGeneration";

type Stage = "setup" | "tracking";

export default function LiveSessionPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [stage, setStage] = useState<Stage>("setup");
  const [config, setConfig] = useState<{
    raceFormat: LiveSessionFormat;
    level: Level;
    targetTime: string;
  } | null>(null);
  const [draftToResume, setDraftToResume] = useState<LiveSessionDraft | null>(
    null,
  );

  const fullReportUnlocked = user?.subscription === "ACTIVE";

  const {
    generatingReport,
    analysis,
    showResultsReveal,
    setShowResultsReveal,
    revealIsPb,
    generateAndSaveReport,
  } = useReportGeneration({
    user,
    savedReports,
    setSavedReports,
    setToast,
    fullReportUnlocked,
  });

  // Minimal, read-only session bootstrap — same pattern as app/app/page.tsx's
  // own initial-load effect, but without any of that page's login/signup UI
  // or billing-sync polling, since this page never lets someone sign in.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialSession() {
      try {
        const currentUser = await getCurrentUser();

        if (cancelled) {
          return;
        }

        setUser(currentUser);
        setSavedReports(
          currentUser ? await loadRemoteReports() : loadSavedReports(),
        );
      } catch {
        if (!cancelled) {
          setSavedReports(loadSavedReports());
        }
      }
    }

    void loadInitialSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // On load, offer to resume an interrupted session rather than silently
  // discarding it — the same check the old embedded startLiveSession() did,
  // relocated to this page's mount instead of a button click.
  useEffect(() => {
    const existingDraft = loadDraft();

    if (!existingDraft) {
      return;
    }

    const resume = window.confirm(
      "You have an unfinished live session in progress. Resume it? (Cancel starts a new session and discards it.)",
    );

    if (resume) {
      setConfig({
        raceFormat: existingDraft.raceFormat,
        level: existingDraft.level,
        targetTime: existingDraft.targetTime,
      });
      setDraftToResume(existingDraft);
      setStage("tracking");
      return;
    }

    clearDraft();
  }, []);

  return (
    <>
      {stage === "setup" ? (
        <LiveSessionSetup
          onCancel={() => router.push("/app")}
          onStart={(nextConfig) => {
            setConfig(nextConfig);
            setStage("tracking");
          }}
        />
      ) : config ? (
        <LiveSessionTracker
          raceFormat={config.raceFormat}
          level={config.level}
          targetTime={config.targetTime}
          initialDraft={draftToResume ?? undefined}
          onExit={() => router.push("/app")}
          onFinish={({ runs, stationSplits, officialFinishTime }) => {
            const finishedConfig = config;
            void generateAndSaveReport({
              goal: "",
              targetTime: finishedConfig.targetTime,
              level: finishedConfig.level,
              runs,
              stationSplits,
              stationDefinitions: getRaceFormatStations(
                finishedConfig.raceFormat,
              ),
              raceFormat: finishedConfig.raceFormat,
              officialFinishTime,
              trainingContext: emptyTrainingContext,
            });
          }}
        />
      ) : null}

      {generatingReport ? <ReportGenerationOverlay /> : null}
      {showResultsReveal && analysis ? (
        <ResultsReveal
          analysis={analysis}
          isNewPB={revealIsPb}
          onClose={() => {
            setShowResultsReveal(false);
            router.push("/app");
          }}
          onViewArchetype={() => {
            setShowResultsReveal(false);
            router.push("/app?tab=new");
          }}
        />
      ) : null}
      {toast ? <Toast toast={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
