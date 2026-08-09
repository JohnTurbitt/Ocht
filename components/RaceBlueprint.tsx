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

  const saving = blueprint.totalSaving;
  const savingPositive = saving > 0;

  return (
    <div className="race-blueprint race-blueprint--mission">
      <div className="race-blueprint__goal-card">
        <p className="race-blueprint__goal-eyebrow">Target</p>
        <div className="race-blueprint__goal-time">{formatTime(analysis.targetSeconds)}</div>
        <div className="race-blueprint__goal-stats">
          <div>
            <span className="race-blueprint__stat-label">Current PR</span>
            <span className="race-blueprint__stat-val">{formatTime(analysis.finishSeconds)}</span>
          </div>
          <div>
            <span className="race-blueprint__stat-label">To cut</span>
            <span className={`race-blueprint__delta-chip${savingPositive ? "" : " race-blueprint__delta-chip--over"}`}>
              {savingPositive ? `-${formatTime(saving)}` : `+${formatTime(Math.abs(saving))}`}
            </span>
          </div>
        </div>
      </div>
      <div className="race-blueprint__plan">
        {blueprint.runSegments.map((seg, i) => (
          <div key={seg.id} className="race-blueprint__plan-row race-blueprint__plan-row--run">
            <span className="race-blueprint__plan-label">{seg.label || `Run ${i + 1}`}</span>
            <span className="race-blueprint__plan-target">{formatTime(blueprint.blueprintRunPerSplit)}</span>
          </div>
        ))}
        {blueprint.stationTargets.map((st) => (
          <div key={st.key} className="race-blueprint__plan-row race-blueprint__plan-row--station">
            <span className="race-blueprint__plan-label">{st.label}</span>
            <span className="race-blueprint__plan-target">{formatTime(st.blueprintSeconds)}</span>
            <span className="race-blueprint__plan-pr">PR {formatTime(st.currentSeconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
