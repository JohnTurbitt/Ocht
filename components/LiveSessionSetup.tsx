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
    <div className="live-page">
      <div className="live-page__topbar">
        <button
          type="button"
          className="live-page__exit"
          onClick={onCancel}
          aria-label="Cancel and go back"
        >
          ‹
        </button>
        <span className="live-page__topbar-label">New session</span>
        <span className="live-page__topbar-spacer" aria-hidden="true" />
      </div>

      <div className="live-session-setup">
        <p className="live-session-setup__eyebrow">HYROX / TRYKA</p>
        <h1 className="live-session-setup__title">
          Start a live
          <br />
          session
        </h1>
        <p className="live-session-setup__guide">
          Lap your watch — or just tap the button on the next screen — after
          every run and every station, 16 taps total. Ready when you are.
        </p>

        <p className="live-session-setup__field-label">Format</p>
        <div className="live-session-setup__format-list">
          {raceFormatOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                option.id === raceFormat
                  ? "live-session-setup__format-card is-active"
                  : "live-session-setup__format-card"
              }
              onClick={() => setRaceFormat(option.id as LiveSessionFormat)}
            >
              <span className="live-session-setup__format-name">
                {option.label}
              </span>
              <span className="live-session-setup__format-sub">
                {option.runLabel} · {option.stations.length} rounds
              </span>
            </button>
          ))}
        </div>

        <p className="live-session-setup__field-label">Level &amp; target</p>
        <div className="live-session-setup__row">
          <label className="field">
            <span>Athlete level</span>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as Level)}
            >
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
              onChange={(event) =>
                setTargetTime(maskTimeInput(event.target.value, "race"))
              }
              onBlur={(event) =>
                setTargetTime(normalizeTimeInput(event.target.value, "race"))
              }
              inputMode="numeric"
              placeholder="1:15:00"
            />
          </label>
        </div>

        <button
          type="button"
          className="live-session-setup__start"
          onClick={() => onStart({ raceFormat, level, targetTime })}
        >
          Start session
        </button>
      </div>
    </div>
  );
}
