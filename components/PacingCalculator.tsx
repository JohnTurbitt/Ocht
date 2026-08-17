"use client";

import { useMemo, useState } from "react";
import { Level, levelLabels } from "@/lib/analysis";
import { buildPacingScenarios, PacingScenario } from "@/lib/pacingPredictor";
import { RaceFormat, raceFormatOptions } from "@/lib/raceFormats";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";
import { parseTime } from "@/lib/analysis";

const DEFAULT_TARGET_TIME = "1:15:00";
const DEFAULT_LEVEL: Level = "competitive";
const DEFAULT_FORMAT: RaceFormat = "hyrox";

export function PacingCalculator() {
  const [targetTime, setTargetTime] = useState(DEFAULT_TARGET_TIME);
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [raceFormat, setRaceFormat] = useState<RaceFormat>(DEFAULT_FORMAT);

  const targetSeconds = parseTime(targetTime);

  const scenarios: PacingScenario[] = useMemo(() => {
    if (targetSeconds <= 0) {
      return [];
    }

    return buildPacingScenarios({ targetSeconds, level, raceFormat });
  }, [targetSeconds, level, raceFormat]);

  const balanced = scenarios[0];

  return (
    <div className="pacing-calculator">
      <div className="pacing-calculator__controls">
        <label className="field">
          <span>Target finish time</span>
          <input
            value={targetTime}
            onChange={(event) => setTargetTime(maskTimeInput(event.target.value, "race"))}
            onBlur={(event) => setTargetTime(normalizeTimeInput(event.target.value, "race"))}
            inputMode="numeric"
            placeholder="1:15:00"
          />
        </label>

        <label className="field">
          <span>Athlete level</span>
          <select value={level} onChange={(event) => setLevel(event.target.value as Level)}>
            {Object.entries(levelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="scroll-fade-wrap format-picker-wrap">
          <div className="format-picker" aria-label="Race format">
            {raceFormatOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === raceFormat ? "format-card is-active" : "format-card"}
                onClick={() => setRaceFormat(option.id)}
              >
                <span className="format-card__name">{option.label}</span>
                <span className="format-card__sub">
                  {option.runLabel} · {option.stations.length} rounds
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {balanced ? (
        <div className="pacing-calculator__scenario">
          <p className="pacing-calculator__note">{balanced.note}</p>
          <div className="pacing-calculator__grid">
            {balanced.segments.map((segment) => (
              <div className="pacing-calculator__row" key={segment.id}>
                <span>{segment.label}</span>
                <span>{formatSegmentTime(segment.seconds)}</span>
              </div>
            ))}
          </div>
          <div className="pacing-calculator__total">
            <span>Projected finish</span>
            <span>{balanced.totalLabel}</span>
          </div>
        </div>
      ) : (
        <p className="pacing-calculator__empty">Enter a target finish time to build a plan.</p>
      )}
    </div>
  );
}

function formatSegmentTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
