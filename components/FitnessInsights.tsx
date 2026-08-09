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
  lastSyncedAt: string;
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

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function predictHyroxRunSecs(bestEffort5kSeconds: number): number {
  // 8 x 1km runs with 12% fatigue factor for running after station work
  return Math.round((bestEffort5kSeconds / 5) * 1.12 * 8);
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
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {isOpen && (
        <p className="fitness-insights__hint-body">{hint}</p>
      )}
    </div>
  );
}

const ZONE_META = [
  { key: "z1" as const, name: "Recovery",  color: "#4ade80" },
  { key: "z2" as const, name: "Aerobic",   color: "#a3e635" },
  { key: "z3" as const, name: "Tempo",     color: "#C8FF2E" },
  { key: "z4" as const, name: "Threshold", color: "#fb923c" },
  { key: "z5" as const, name: "VO2 Max",   color: "#f87171" },
];
const ZONE_WIDTHS = [100, 82, 65, 50, 36];

function PaceZonesBars({ zones }: { zones: PaceZones }) {
  return (
    <div className="fitness-insights__pace-zones">
      <p className="fitness-insights__zones-title">Pace zones</p>
      {ZONE_META.map((z, i) => {
        const zone = zones[z.key];
        const range = `${fmtPace(zone.minPaceSec)}-${fmtPace(zone.maxPaceSec)} /km`;
        return (
          <div key={z.key} className="fitness-insights__zone-row">
            <span className="fitness-insights__zone-label">{z.key.toUpperCase()}</span>
            <div className="fitness-insights__zone-bar-wrap">
              <div
                className="fitness-insights__zone-bar"
                style={{ width: `${ZONE_WIDTHS[i]}%`, background: `${z.color}44`, color: z.color }}
              >
                <span className="fitness-insights__zone-pace">{range}</span>
              </div>
            </div>
            <span className="fitness-insights__zone-name">{z.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FitnessInsights({ fullReportUnlocked }: Props) {
  const [profile, setProfile] = useState<StravaInsightsProfile | null | undefined>(undefined);
  const [authenticated, setAuthenticated] = useState(true);
  const [openHint, setOpenHint] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/strava/profile")
      .then((r) => {
        if (r.status === 401) {
          setAuthenticated(false);
          return null;
        }
        return r.json() as Promise<{ profile: StravaInsightsProfile | null }>;
      })
      .then((data) => {
        if (data) setProfile(data.profile ?? null);
      })
      .catch(() => {
        setProfile(null);
      });
  }, []);

  function handleToggle(id: string) {
    setOpenHint((prev) => (prev === id ? null : id));
  }

  if (!authenticated) return null;
  if (profile === undefined) return null;

  if (profile === null) {
    return (
      <div className="fitness-insights fitness-insights--connect">
        <p className="eyebrow">Fitness insights</p>
        <h3>Connect Strava to unlock <PremiumBadge /></h3>
        <p>Lactate threshold, training load, aerobic efficiency and pace zones, calculated from your Strava history.</p>
        <a href="/api/strava/connect" className="strava-connect-btn">
          <img src="/brand/strava/btn_strava_connect_with_orange.svg" alt="Connect with Strava" />
        </a>
      </div>
    );
  }

  if (!fullReportUnlocked) {
    return (
      <div className="fitness-insights fitness-insights--locked">
        <p className="eyebrow">Fitness insights</p>
        <h3>Unlock to see your fitness data <PremiumBadge /></h3>
        <p>Your Strava profile is synced. Upgrade to premium to see lactate threshold, training load and pace zones.</p>
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
    lastSyncedAt,
  } = profile;

  const parsedZones = isPaceZones(paceZonesJson) ? paceZonesJson : null;

  const effortParts: string[] = [];
  if (bestEffort5kSeconds !== null) effortParts.push(`5k ${fmtPace(bestEffort5kSeconds)}`);
  if (bestEffort10kSeconds !== null) effortParts.push(`10k ${fmtPace(bestEffort10kSeconds)}`);

  const hyroxRunSecs = bestEffort5kSeconds !== null ? predictHyroxRunSecs(bestEffort5kSeconds) : null;

  return (
    <div className="fitness-insights">
      <div className="fitness-insights__header">
        <p className="eyebrow">Fitness insights</p>
        <img
          className="strava-wordmark-chip"
          src="/brand/strava/api_logo_pwrdBy_strava_horiz_white.svg"
          alt="Powered by Strava"
        />
      </div>
      <h3>Your training data</h3>
      {parsedZones !== null && <PaceZonesBars zones={parsedZones} />}
      <p className="fitness-insights__synced-at">Last synced {relativeTime(lastSyncedAt)}</p>
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
            hint="Cardiac decoupling measures whether your heart rate drifts higher relative to your pace on long runs. Under 5% means your aerobic base is solid. Above 5% suggests more easy aerobic volume would help, especially for the later runs in a Hyrox."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
        {effortParts.length > 0 && (
          <MetricRow
            id="efforts"
            label="Running fitness"
            value={effortParts.join(" · ")}
            hint="Estimated from your Strava activities using the Riegel formula. They represent your current running fitness rather than a specific race result, useful as a baseline for your Hyrox run targets."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
        {hyroxRunSecs !== null && (
          <MetricRow
            id="hyrox"
            label="Hyrox run target"
            value={`${fmtPace(hyroxRunSecs)} · ${fmtPace(hyroxRunSecs / 8)}/km`}
            hint="Total running time across 8 x 1km runs, estimated from your 5k fitness with a 12% adjustment for running after station work. Use this as a pacing target for your runs, not a full race time prediction. Station performance and transitions are separate."
            openHint={openHint}
            onToggle={handleToggle}
          />
        )}
      </div>
    </div>
  );
}
