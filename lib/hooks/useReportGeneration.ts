"use client";

import { useState } from "react";
import {
  Analysis,
  Level,
  Station,
  StationKey,
  buildAnalysis,
} from "@/lib/analysis";
import { RaceFormat } from "@/lib/raceFormats";
import { AuthUser, saveRemoteReport } from "@/lib/apiClient";
import { SavedReport, saveReports } from "@/lib/reportStorage";
import { groupKeyForReport, isNewPersonalBest } from "@/lib/progress";
import { TrainingContext, hasTrainingContext } from "@/lib/trainingContext";
import { trackEvent } from "@/lib/analytics";
import type { ToastMessage } from "@/components/Toast";

export type GenerateReportInput = {
  goal: string;
  targetTime: string;
  level: Level;
  runs: string[];
  stationSplits: Record<StationKey, string>;
  stationDefinitions: Station[];
  raceFormat: RaceFormat;
  officialFinishTime: string;
  trainingContext: TrainingContext;
};

export type UseReportGenerationOptions = {
  user: AuthUser | null;
  savedReports: SavedReport[];
  setSavedReports: (reports: SavedReport[]) => void;
  setToast: (toast: ToastMessage) => void;
  fullReportUnlocked: boolean;
  // Called once the report has been generated and saved successfully —
  // for page-specific side effects (e.g. switching tabs). Not called on
  // the remote-save-failure path (the report still shows, but nothing
  // page-specific about "success" happened).
  onSaved?: () => void;
  // Called after the async work finishes, on BOTH the success and the
  // remote-save-failure path — for page-specific cleanup that should
  // happen regardless of outcome (e.g. clearing validation-error state,
  // scrolling to where the report now renders).
  onSettled?: () => void;
};

export function useReportGeneration({
  user,
  savedReports,
  setSavedReports,
  setToast,
  fullReportUnlocked,
  onSaved,
  onSettled,
}: UseReportGenerationOptions) {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [showResultsReveal, setShowResultsReveal] = useState(false);
  const [revealIsPb, setRevealIsPb] = useState(false);

  async function generateAndSaveReport(input: GenerateReportInput) {
    const {
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      stationDefinitions,
      raceFormat,
      officialFinishTime,
      trainingContext,
    } = input;

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
      stationDefinitions,
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
        raceFormat === "custom" ? stationDefinitions : undefined,
      stationSplits,
      trainingContext: hasTrainingContext(trainingContext)
        ? trainingContext
        : undefined,
      finishSeconds: generatedAnalysis.finishSeconds,
      predictedTargetSeconds: generatedAnalysis.predictedTargetSeconds,
      topLeakLabel: generatedAnalysis.topLeaks[0]?.label ?? "",
    };
    let nextReports = [savedReport, ...savedReports].slice(0, 12);

    if (user) {
      try {
        const remoteReport = await saveRemoteReport({
          goal,
          targetTime,
          level,
          raceFormat,
          runs,
          stationDefinitions:
            raceFormat === "custom" ? stationDefinitions : undefined,
          stationSplits,
          trainingContext: hasTrainingContext(trainingContext)
            ? trainingContext
            : undefined,
        });

        nextReports = [remoteReport, ...savedReports];
      } catch (error) {
        await minimumHold;
        setGeneratingReport(false);
        setAnalysis(generatedAnalysis);
        setToast({
          id: Date.now(),
          title: "Report generated",
          message:
            error instanceof Error
              ? `${error.message} The report is visible below but was not saved.`
              : "The report is visible below but was not saved to your account.",
          tone: "error",
        });
        onSettled?.();
        return;
      }
    } else {
      saveReports(nextReports);
    }

    await minimumHold;
    setGeneratingReport(false);
    setAnalysis(generatedAnalysis);
    setRevealIsPb(
      isNewPersonalBest(
        savedReports,
        generatedAnalysis.finishSeconds,
        groupKeyForReport(savedReport),
      ),
    );
    setShowResultsReveal(true);
    setSavedReports(nextReports);
    trackEvent("report_generated", {
      race_format: raceFormat,
      signed_in: Boolean(user),
      premium: fullReportUnlocked,
      saved_remote: Boolean(user),
      run_count: runs.length,
      station_count: stationDefinitions.length,
    });
    onSaved?.();
    onSettled?.();
  }

  return {
    generatingReport,
    analysis,
    setAnalysis,
    showResultsReveal,
    setShowResultsReveal,
    revealIsPb,
    generateAndSaveReport,
  };
}
