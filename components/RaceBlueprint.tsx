"use client";

import { useEffect, useState } from "react";
import { Analysis, formatTime } from "@/lib/analysis";
import { PremiumBadge } from "./PremiumBadge";

interface BlueprintProfile {
  bestEffort5kSeconds: number | null;
  lastSyncedAt: string;
}

interface Props {
  analysis: Analysis;
  fullReportUnlocked: boolean;
}

function computeBlueprint(analysis: Analysis, bestEffort5kSeconds: number) {
  const runSegments = analysis.raceSegments.filter((s) => s.type === "run");
  const runCount = runSegments.length;
  if (runCount === 0) return null;

  const runDistanceKm =
    analysis.raceFormat === "tryka500" ? 0.5
    : analysis.raceFormat === "tryka800" ? 0.8
    : 1.0;

  const pacePerKm = bestEffort5kSeconds / 5;
  const blueprintRunPerSplit = Math.round(pacePerKm * 1.12 * runDistanceKm);
  const totalRunBudget = blueprintRunPerSplit * runCount;

  const stationBudget = analysis.targetSeconds - totalRunBudget - analysis.roxzoneSeconds;
  const feasible = stationBudget > 0 && stationBudget < analysis.totalStationSeconds * 1.5;

  const stationTargets = analysis.stationResults.map((sr) => {
    const proportional = Math.round(
      sr.seconds * (stationBudget / analysis.totalStationSeconds),
    );
    return {
      key: sr.key,
      label: sr.label,
      currentSeconds: sr.seconds,
      blueprintSeconds: Math.max(proportional, sr.benchmark),
    };
  });

  const totalBlueprintStation = stationTargets.reduce(
    (sum, t) => sum + t.blueprintSeconds,
    0,
  );
  const totalBlueprint = totalRunBudget + totalBlueprintStation + analysis.roxzoneSeconds;
  const totalSaving = analysis.finishSeconds - totalBlueprint;

  return {
    runSegments,
    blueprintRunPerSplit,
    runDistanceKm,
    stationTargets,
    totalRunBudget,
    totalBlueprintStation,
    totalBlueprint,
    totalSaving,
    feasible,
    stationBudget,
    runCount,
  };
}

export function RaceBlueprint({ analysis, fullReportUnlocked }: Props) {
  const [profile, setProfile] = useState<BlueprintProfile | null | undefined>(undefined);
  const [authenticated, setAuthenticated] = useState(true);

  useEffect(() => {
    fetch("/api/strava/profile")
      .then((r) => {
        if (r.status === 401) {
          setAuthenticated(false);
          return null;
        }
        return r.json() as Promise<{ profile: BlueprintProfile | null }>;
      })
      .then((data) => {
        if (data) setProfile(data.profile ?? null);
      })
      .catch(() => {
        setProfile(null);
      });
  }, []);

  if (!authenticated) return null;
  if (profile === undefined) return null;
  if (profile === null || profile.bestEffort5kSeconds === null) return null;

  if (!fullReportUnlocked) {
    return (
      <div className="race-blueprint race-blueprint--locked">
        <p className="eyebrow">Race blueprint</p>
        <h3>Your personalised split plan <PremiumBadge /></h3>
        <p>Upgrade to see exact target times for every station and run, calculated from your Strava fitness.</p>
      </div>
    );
  }

  if (analysis.stationResults.length === 0) return null;

  const blueprint = computeBlueprint(analysis, profile.bestEffort5kSeconds);
  if (!blueprint) return null;

  return (
    <div className="race-blueprint">
      <p className="eyebrow">Race blueprint</p>
      <h3>Your personalised split plan</h3>

      <p className="race-blueprint__summary">
        Based on your Strava fitness, your {blueprint.runCount} runs should take{" "}
        {formatTime(blueprint.totalRunBudget)} total ({formatTime(blueprint.blueprintRunPerSplit)}{" "}
        per {blueprint.runDistanceKm}km). Stations need to come in at{" "}
        {formatTime(blueprint.totalBlueprintStation)} combined to hit your{" "}
        {formatTime(analysis.targetSeconds)} target.
      </p>

      {!blueprint.feasible && (
        <p className="race-blueprint__warning">
          ⚠ Your run target alone makes this goal very aggressive. Consider adjusting
          your target time or focusing on one area at a time.
        </p>
      )}

      <div className="race-blueprint__table">
        <div className="race-blueprint__thead">
          <span>Segment</span>
          <span>Now</span>
          <span>Blueprint</span>
          <span>Save</span>
        </div>

        {blueprint.runSegments.map((seg, i) => {
          const saving = seg.actualSeconds - blueprint.blueprintRunPerSplit;
          return (
            <div key={seg.id} className="race-blueprint__row race-blueprint__row--run">
              <span>{seg.label || `Run ${i + 1}`}</span>
              <span>{formatTime(seg.actualSeconds)}</span>
              <span className="race-blueprint__target">{formatTime(blueprint.blueprintRunPerSplit)}</span>
              <span className={saving > 0 ? "race-blueprint__save" : "race-blueprint__behind"}>
                {saving > 0 ? `-${formatTime(saving)}` : `+${formatTime(Math.abs(saving))}`}
              </span>
            </div>
          );
        })}

        {blueprint.stationTargets.map((st) => {
          const saving = st.currentSeconds - st.blueprintSeconds;
          return (
            <div key={st.key} className="race-blueprint__row race-blueprint__row--station">
              <span>{st.label}</span>
              <span>{formatTime(st.currentSeconds)}</span>
              <span className="race-blueprint__target">{formatTime(st.blueprintSeconds)}</span>
              <span className={saving > 0 ? "race-blueprint__save" : "race-blueprint__behind"}>
                {saving > 0 ? `-${formatTime(saving)}` : `+${formatTime(Math.abs(saving))}`}
              </span>
            </div>
          );
        })}

        <div className="race-blueprint__row race-blueprint__row--total">
          <span>Total</span>
          <span>{formatTime(analysis.finishSeconds)}</span>
          <span className="race-blueprint__target">{formatTime(blueprint.totalBlueprint)}</span>
          <span className={blueprint.totalSaving > 0 ? "race-blueprint__save" : "race-blueprint__behind"}>
            {blueprint.totalSaving > 0
              ? `-${formatTime(blueprint.totalSaving)}`
              : `+${formatTime(Math.abs(blueprint.totalSaving))}`}
          </span>
        </div>
      </div>

      <p className="race-blueprint__footnote">
        Run targets use a 12% adjustment for post-station fatigue. Station targets are
        distributed proportionally from your current times and capped at your level
        benchmark — nothing asks you to go below it.
      </p>
    </div>
  );
}
