"use client";

import { useState } from "react";
import { Level, levelLabels } from "@/lib/analysis";
import { LiveSessionFormat } from "@/lib/liveSession";
import { raceFormatOptions } from "@/lib/raceFormats";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";

type LiveSessionSetupProps = {
  onStart: (input: { raceFormat: LiveSessionFormat; level: Level; targetTime: string }) => void;
  onCancel: () => void;
};

export function LiveSessionSetup({ onStart, onCancel }: LiveSessionSetupProps) {
  const [raceFormat, setRaceFormat] = useState<LiveSessionFormat>("hyrox");
  const [level, setLevel] = useState<Level>("competitive");
  const [targetTime, setTargetTime] = useState("");

  return (
    <div className="live-session-setup">
      <p className="eyebrow">Live session</p>
      <h2>Start a race or training set</h2>
      <p className="live-session-setup__guide">
        Lap your watch — or just tap the button on the next screen — after
        every run and every station, 16 taps total. Ready when you are.
      </p>

      <div className="input-row">
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

        <label className="field">
          <span>Target time (optional)</span>
          <input
            value={targetTime}
            onChange={(event) => setTargetTime(maskTimeInput(event.target.value, "race"))}
            onBlur={(event) => setTargetTime(normalizeTimeInput(event.target.value, "race"))}
            inputMode="numeric"
            placeholder="1:15:00"
          />
        </label>
      </div>

      <div className="scroll-fade-wrap format-picker-wrap">
        <div className="format-picker" aria-label="Race format">
          {raceFormatOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={option.id === raceFormat ? "format-card is-active" : "format-card"}
              onClick={() => setRaceFormat(option.id as LiveSessionFormat)}
            >
              <span className="format-card__name">{option.label}</span>
              <span className="format-card__sub">
                {option.runLabel} · {option.stations.length} rounds
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="live-session-setup__actions">
        <button type="button" onClick={onCancel} className="btn btn--secondary">
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => onStart({ raceFormat, level, targetTime })}
        >
          Start session
        </button>
      </div>
    </div>
  );
}
