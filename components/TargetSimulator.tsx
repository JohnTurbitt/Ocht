"use client";

import { useState } from "react";
import { formatTime } from "@/lib/analysis";

type StationSlider = {
  key: string;
  label: string;
  prSeconds: number;
  currentSeconds: number;
};

type TargetSimulatorProps = {
  stations: StationSlider[];
};

export function TargetSimulator({ stations }: TargetSimulatorProps) {
  const [targets, setTargets] = useState<Record<string, number>>(
    Object.fromEntries(stations.map((s) => [s.key, s.prSeconds]))
  );

  function handleSlider(key: string, value: number) {
    setTargets((prev) => ({ ...prev, [key]: value }));
  }

  function resetToPRs() {
    setTargets(Object.fromEntries(stations.map((s) => [s.key, s.prSeconds])));
  }

  const total = Object.values(targets).reduce((sum, v) => sum + v, 0);

  return (
    <div className="simulator simulator--sliders">
      <div className="simulator__total">
        <span className="simulator__total-label">Target stations total</span>
        <strong className="simulator__total-time">{formatTime(total)}</strong>
      </div>
      <div className="simulator__station-list">
        {stations.map((station) => {
          const val = targets[station.key] ?? station.prSeconds;
          const overPR = val > station.prSeconds;
          const minVal = Math.max(0, station.prSeconds - 120);
          const maxVal = station.prSeconds + 120;
          return (
            <div key={station.key} className={`simulator__station-row${overPR ? " simulator__station-row--over-pr" : ""}`}>
              <div className="simulator__station-head">
                <span className="simulator__station-name">{station.label}</span>
                <div className="simulator__station-times">
                  <span className="simulator__station-target">{formatTime(val)}</span>
                  <span className="simulator__station-pr">PR {formatTime(station.prSeconds)}</span>
                </div>
              </div>
              <input
                type="range"
                className={`simulator__slider${overPR ? " simulator__slider--over-pr" : ""}`}
                min={minVal} max={maxVal} step={1} value={val}
                onChange={(e) => handleSlider(station.key, Number(e.target.value))}
                aria-label={`Target time for ${station.label}`}
              />
            </div>
          );
        })}
      </div>
      <button type="button" className="simulator__reset" onClick={resetToPRs}>
        Reset to PRs
      </button>
    </div>
  );
}
