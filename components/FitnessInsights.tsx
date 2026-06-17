"use client";

import { useEffect, useState } from "react";
import { PremiumBadge } from "./PremiumBadge";

interface StravaInsightsProfile {
  lthrBpm: number | null;
  ctlScore: number | null;
  atlScore: number | null;
  cardiacDecouplingPct: number | null;
  paceZonesJson: unknown;
  bestEffort5kSeconds: number | null;
  bestEffort10kSeconds: number | null;
}

interface Props {
  fullReportUnlocked: boolean;
}

interface PaceZone {
  minPaceSec: number;
  maxPaceSec: number;
}

interface PaceZones {
  z1: PaceZone;
  z2: PaceZone;
  z3: PaceZone;
  z4: PaceZone;
  z5: PaceZone;
}

function fmtPace(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function isPaceZones(val: unknown): val is PaceZones {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  for (const key of ["z1", "z2", "z3", "z4", "z5"]) {
    const zone = obj[key];
    if (
      typeof zone !== "object" ||
      zone === null ||
      typeof (zone as Record<string, unknown>).minPaceSec !== "number" ||
      typeof (zone as Record<string, unknown>).maxPaceSec !== "number"
    ) {
      return false;
    }
  }
  return true;
}

function MetricRow({
  id,
  label,
  value,
  hint,
  openHint,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  openHint: string | null;
  onToggle: (id: string) => void;
}) {
  const isOpen = openHint === id;
  return (
    <div className="fitness-insights__row">
      <div className="fitness-insights__row-main">
        <span className="fitness-insights__row-label">{label}</span>
        <span className="fitness-insights__row-value">{value}</span>
        <button
          type="button"
          className={`fitness-insights__hint-toggle${isOpen ? " fitness-insights__hint-toggle--open" : ""}`}
          onClick={() => onToggle(id)}
          aria-label={isOpen ? "Close explanation" : "What does this mean?"}
        >
          ?
        </button>
      </div>
      {isOpen && (
        <p className="fitness-insights__hint-body">{hint}</p>
      )}
    </div>
  );
}

export function FitnessInsights({ fullReportUnlocked }: Props) {
  const [profile, setProfile] = useState<StravaInsightsProfile | null | undefined>(undefined);
  const [openHint, setOpenHint] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/strava/profile")
      .then((r) => r.json())
      .then((data: { profile: StravaInsightsProfile | null }) => {
        setProfile(data.profile ?? null);
      })
      .catch(() => {
        setProfile(null);
      });
  }, []);

  if (profile === undefined) return null;

  function handleToggle(id: string) {
    setOpenHint((prev) => (prev === id ? null : id));
  }

  if (profile === null) {
    return (
      <div className="fitness-insights fitness-insights--connect">
        <p className="eyebrow">Fitness insights</p>
        <h3>Connect Strava to unlock <PremiumBadge /></h3>
        <p>Lactate threshold, training load, aerobic efficiency and pace zones — calculated from your Strava history.</p>
      </div>
    );
  }

  if (!fullReportUnlocked) {
    return (
      <div className="fitness-insights fitness-insights--locked">
        <p className="eyebrow">Fitness insights</p>
        <h3>Unlock to see your fitness data <PremiumBadge /></h3>
        <p>Your Strava profile is synced. Upgrade to premium to see lactate threshold, training load, and pace zones.</p>
      </div>
    );
  }

  const {
    lthrBpm,
    ctlScore,
    atlScore,
    cardiacDecouplingPct,
    paceZonesJson,
    bestEffort5kSeconds,
    bestEffort10kSeconds,
  } = profile;

  const parsedZones = isPaceZones(paceZonesJson) ? paceZonesJson : null;

  const effortParts: string[] = [];
  if (bestEffort5kSeconds !== null) effortParts.push(`5k ${fmtTime(bestEffort5kSeconds)}`);
  if (bestEffort10kSeconds !== null) effortParts.push(`10k ${fmtTime(bestEffort10kSeconds)}`);

  return (
    <div className="fitness-insights">
      <p className="eyebrow">Fitness insights</p>
      <h3>Your training data</h3>
      <div className="fitness-insights__rows">
        {lthrBpm !== null && (
          <MetricRow
            id="lthr"
            label="Lactate threshold"
            value={`${lthrBpm} bpm`}
            hint="Your lactate threshold heart rate is the intensity where your body shifts from burning fat to burning glycogen. Training below this builds your aerobic base; racing above it for the whole of a Hyrox is unsustainable."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
        {ctlScore !== null && atlScore !== null && (
          <MetricRow
            id="load"
            label="Training load"
            value={`Fitness ${ctlScore} · Fatigue ${atlScore}`}
            hint="Fitness (CTL) reflects your training load over the past 6 weeks. Fatigue (ATL) is your load over the last 7 days. A fatigue score close to or above your fitness score means you may be carrying tiredness into your race. A gap of 5–15 points is usually a good race window."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
        {cardiacDecouplingPct !== null && (
          <MetricRow
            id="decoupling"
            label="Aerobic efficiency"
            value={`${cardiacDecouplingPct}% decoupling`}
            hint="Cardiac decoupling measures whether your heart rate drifts higher relative to your pace on long runs. Under 5% means your aerobic base is solid. Above 5% suggests more easy aerobic volume would help — especially for the later runs in a Hyrox."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
        {parsedZones !== null && (
          <MetricRow
            id="zones"
            label="Pace zones"
            value={`Z2 ${fmtPace(parsedZones.z2.minPaceSec)}–${fmtPace(parsedZones.z2.maxPaceSec)} /km`}
            hint="Your pace zones are calculated from your estimated 5k fitness. Zone 2 is your aerobic base pace — where most of your easy running should sit. Zones 4 and 5 are race and interval intensity. Running your Hyrox runs in Zone 3–4 is the target for most athletes."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
        {effortParts.length > 0 && (
          <MetricRow
            id="efforts"
            label="Running fitness"
            value={effortParts.join(" · ")}
            hint="Estimated from your Strava activities using the Riegel formula. They represent your current running fitness rather than a specific race result — useful as a baseline for your Hyrox run targets."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
      </div>
    </div>
  );
}
