import { FormEvent, useState } from "react";
import { Hint } from "@/components/Hint";
import { PremiumBadge } from "@/components/PremiumBadge";
import {
  Level,
  Station,
  StationKey,
  levelLabels,
} from "@/lib/analysis";
import { CustomTemplate } from "@/lib/customTemplates";
import { RaceFormat, raceFormatOptions } from "@/lib/raceFormats";
import { TrainingContext, TrainingTrend } from "@/lib/trainingContext";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";

type SplitFormProps = {
  raceFormat: RaceFormat;
  fullReportUnlocked: boolean;
  showStartGuide: boolean;
  onShowGuide: () => void;
  goal: string;
  targetTime: string;
  officialFinishTime: string;
  level: Level;
  runs: string[];
  stationDefinitions: Station[];
  stationSplits: Record<StationKey, string>;
  trainingContext: TrainingContext;
  errors: string[];
  fieldErrors: Record<string, string>;
  customTemplates: CustomTemplate[];
  onRaceFormatChange: (value: RaceFormat) => void;
  onCustomFormatClick: () => void;
  onAddRun: () => void;
  onRemoveRun: (index: number) => void;
  onAddCustomStation: () => void;
  onRemoveCustomStation: (key: StationKey) => void;
  onCustomStationLabelChange: (key: StationKey, value: string) => void;
  onSaveCustomTemplate: () => void;
  onLoadCustomTemplate: (template: CustomTemplate) => void;
  onDeleteCustomTemplate: (templateId: string) => void;
  onGoalChange: (value: string) => void;
  onTargetTimeChange: (value: string) => void;
  onOfficialFinishChange: (value: string) => void;
  onLevelChange: (value: Level) => void;
  onRunChange: (index: number, value: string) => void;
  onStationChange: (key: StationKey, value: string) => void;
  onTrainingContextChange: (field: keyof TrainingContext, value: string) => void;
  onLoadSample: () => void;
  onResetDefaults: () => void;
  onClearForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SplitForm({
  raceFormat,
  fullReportUnlocked,
  showStartGuide,
  onShowGuide,
  goal,
  targetTime,
  officialFinishTime,
  level,
  runs,
  stationDefinitions,
  stationSplits,
  trainingContext,
  errors,
  fieldErrors,
  customTemplates,
  onRaceFormatChange,
  onCustomFormatClick,
  onAddRun,
  onRemoveRun,
  onAddCustomStation,
  onRemoveCustomStation,
  onCustomStationLabelChange,
  onSaveCustomTemplate,
  onLoadCustomTemplate,
  onDeleteCustomTemplate,
  onGoalChange,
  onTargetTimeChange,
  onOfficialFinishChange,
  onLevelChange,
  onRunChange,
  onStationChange,
  onTrainingContextChange,
  onLoadSample,
  onResetDefaults,
  onClearForm,
  onSubmit,
}: SplitFormProps) {
  const isCustom = raceFormat === "custom";
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>({});
  const setRoundOpen = (index: number, open: boolean) =>
    setOpenRounds((current) => ({ ...current, [index]: open }));

  const roundComplete = stationDefinitions.map((station, index) => {
    const runValue = (runs[index] ?? "").trim();
    const stationValue = (stationSplits[station.key] ?? "").trim();
    return Boolean(runValue) && Boolean(stationValue);
  });
  const roundFilledCount = roundComplete.filter(Boolean).length;

  // Progressive reveal: round 1 starts open, and each later round opens once the
  // round above it is complete. We never force a round closed, and a manual
  // toggle (stored in openRounds) always wins.
  const isRoundOpen = (index: number) =>
    openRounds[index] ?? (index === 0 || roundComplete[index - 1] === true);

  // Keep the primary CTA from inviting a press on a totally blank form (which
  // would just produce a wall of validation errors).
  const hasAnyInput =
    Boolean(targetTime.trim()) ||
    runs.some((value) => value.trim()) ||
    Object.values(stationSplits).some((value) => value?.trim());

  return (
    <form className="split-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <div className="section-heading">
          <p className="eyebrow">Race input</p>
          <h2>Build your race file</h2>
        </div>
        <div className="preset-actions" aria-label="Report presets">
          <button type="button" onClick={onLoadSample}>
            Load sample race
          </button>
          <button type="button" onClick={onResetDefaults}>
            Reset defaults
          </button>
          <button type="button" onClick={onClearForm}>
            Clear form
          </button>
          <button
            className="preset-actions__help"
            type="button"
            onClick={onShowGuide}
          >
            How it works
          </button>
        </div>
      </div>

      {showStartGuide ? (
        <div className="start-guide" aria-label="How to start">
          <article>
            <span>1</span>
            <strong>Start simple</strong>
            <p>Load the sample race if you are not sure what to enter yet.</p>
          </article>
          <article>
            <span>2</span>
            <strong>Add splits</strong>
            <p>Use times from runs and workout stations, like 530 for 5:30.</p>
          </article>
          <article>
            <span>3</span>
            <strong>Read cockpit</strong>
            <p>Start with finish, time to find, biggest leak, and next action.</p>
          </article>
        </div>
      ) : null}

      <div className="format-picker" aria-label="Race format">
        {raceFormatOptions.map((option) => (
          <button
            key={option.id}
            className={option.id === raceFormat ? "is-active" : undefined}
            type="button"
            onClick={() => onRaceFormatChange(option.id)}
          >
            {option.label}
          </button>
        ))}
        <button
          className={isCustom ? "is-active" : undefined}
          type="button"
          onClick={onCustomFormatClick}
        >
          Custom <PremiumBadge />
        </button>
      </div>

      {isCustom ? (
        <div className="custom-builder">
          <div>
            <h3>Custom race builder</h3>
            <p>
              Add the runs and stations for this race setup, then save it as a
              reusable template.
            </p>
          </div>
          <div className="custom-builder__actions">
            <button type="button" onClick={onAddRun}>
              Add run
            </button>
            <button type="button" onClick={onAddCustomStation}>
              Add station
            </button>
            <button
              type="button"
              onClick={onSaveCustomTemplate}
              disabled={!fullReportUnlocked}
            >
              Save template <PremiumBadge />
            </button>
          </div>
          {customTemplates.length > 0 ? (
            <div className="custom-template-list">
              {customTemplates.map((template) => (
                <div className="custom-template-list__item" key={template.id}>
                  <button
                    type="button"
                    onClick={() => onLoadCustomTemplate(template)}
                  >
                    {template.name}
                  </button>
                  <button
                    className="custom-template-list__delete"
                    type="button"
                    onClick={() => onDeleteCustomTemplate(template.id)}
                    aria-label={`Delete ${template.name}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="form-errors" role="alert">
          <h3>Fix these before generating</h3>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="input-row">
        <label className="field">
          <span>Goal</span>
          <input
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder="Sub 1:25 at my next race"
          />
        </label>

        <label className="field">
          <span>Target time</span>
          <input
            className={fieldErrors.targetTime ? "is-invalid" : undefined}
            value={targetTime}
            onChange={(event) =>
              onTargetTimeChange(maskTimeInput(event.target.value, "race"))
            }
            onBlur={(event) =>
              onTargetTimeChange(normalizeTimeInput(event.target.value, "race"))
            }
            inputMode="numeric"
            placeholder="1:25:00"
            aria-invalid={Boolean(fieldErrors.targetTime)}
          />
          {fieldErrors.targetTime ? (
            <small className="field-error">{fieldErrors.targetTime}</small>
          ) : null}
        </label>
      </div>

      <div className="input-row">
        <label className="field">
          <span>Athlete level</span>
          <select
            value={level}
            onChange={(event) => onLevelChange(event.target.value as Level)}
          >
            {Object.entries(levelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Official finish (optional)</span>
          <input
            value={officialFinishTime}
            onChange={(event) =>
              onOfficialFinishChange(maskTimeInput(event.target.value, "race"))
            }
            onBlur={(event) =>
              onOfficialFinishChange(
                normalizeTimeInput(event.target.value, "race"),
              )
            }
            inputMode="numeric"
            placeholder="1:28:30"
          />
          <small className="field-hint">
            Add your chip time to reveal roxzone (transition) time.
          </small>
        </label>
      </div>

      <div className="training-context-input">
        <div className="training-context-input__header">
          <div>
            <h3>Training context</h3>
            <p>
              Optional, but it lets Ocht explain the running limiter instead of
              only ranking race splits.
            </p>
          </div>
          <button type="button" disabled>
            Connect Strava <PremiumBadge />
          </button>
        </div>
        <div className="training-context-grid">
          <label className="field">
            <span>Runs / week</span>
            <input
              value={trainingContext.runsPerWeek}
              onChange={(event) =>
                onTrainingContextChange("runsPerWeek", event.target.value)
              }
              inputMode="decimal"
              placeholder="4"
            />
          </label>
          <label className="field">
            <span>Weekly km</span>
            <input
              value={trainingContext.weeklyDistanceKm}
              onChange={(event) =>
                onTrainingContextChange("weeklyDistanceKm", event.target.value)
              }
              inputMode="decimal"
              placeholder="32"
            />
          </label>
          <label className="field">
            <span>Longest run km</span>
            <input
              value={trainingContext.longestRunKm}
              onChange={(event) =>
                onTrainingContextChange("longestRunKm", event.target.value)
              }
              inputMode="decimal"
              placeholder="12"
            />
          </label>
          <label className="field">
            <span>Hard runs / week</span>
            <input
              value={trainingContext.hardRunsPerWeek}
              onChange={(event) =>
                onTrainingContextChange("hardRunsPerWeek", event.target.value)
              }
              inputMode="decimal"
              placeholder="1"
            />
          </label>
          <label className="field">
            <span>
              <Hint
                enabled
                hint="compromisedRun"
                term="Compromised runs"
              />
            </span>
            <input
              value={trainingContext.compromisedRunsPerWeek}
              onChange={(event) =>
                onTrainingContextChange(
                  "compromisedRunsPerWeek",
                  event.target.value,
                )
              }
              inputMode="decimal"
              placeholder="0"
            />
          </label>
          <label className="field">
            <span>Strength sessions</span>
            <input
              value={trainingContext.strengthSessionsPerWeek}
              onChange={(event) =>
                onTrainingContextChange(
                  "strengthSessionsPerWeek",
                  event.target.value,
                )
              }
              inputMode="decimal"
              placeholder="2"
            />
          </label>
          <label className="field">
            <span>Rest days / week</span>
            <input
              value={trainingContext.restDaysPerWeek}
              onChange={(event) =>
                onTrainingContextChange("restDaysPerWeek", event.target.value)
              }
              inputMode="decimal"
              placeholder="2"
            />
          </label>
          <label className="field">
            <span>Recent trend</span>
            <select
              value={trainingContext.recentTrend}
              onChange={(event) =>
                onTrainingContextChange(
                  "recentTrend",
                  event.target.value as TrainingTrend,
                )
              }
            >
              <option value="building">Building</option>
              <option value="stable">Stable</option>
              <option value="dropping">Dropping</option>
            </select>
          </label>
        </div>
      </div>

      {isCustom ? (
        <>
          <div className="split-group">
            <h3>Run splits</h3>
            <div className="split-grid">
              {runs.map((split, index) => (
                <label className="field" key={`run-${index + 1}`}>
                  <span>Run {index + 1}</span>
                  <input
                    className={
                      fieldErrors[`run-${index}`] ? "is-invalid" : undefined
                    }
                    value={split}
                    onChange={(event) => onRunChange(index, maskTimeInput(event.target.value))}
                    onBlur={(event) =>
                      onRunChange(index, normalizeTimeInput(event.target.value))
                    }
                    inputMode="numeric"
                    placeholder="mm:ss"
                    aria-invalid={Boolean(fieldErrors[`run-${index}`])}
                  />
                  {fieldErrors[`run-${index}`] ? (
                    <small className="field-error">
                      {fieldErrors[`run-${index}`]}
                    </small>
                  ) : null}
                  {runs.length > 1 ? (
                    <button
                      className="field-action"
                      type="button"
                      onClick={() => onRemoveRun(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </label>
              ))}
            </div>
          </div>

          <div className="split-group">
            <h3>Stations</h3>
            <div className="split-grid">
              {stationDefinitions.map((station) => (
                <label className="field" key={station.key}>
                  <input
                    className={
                      fieldErrors[`station-${station.key}-label`]
                        ? "station-name-input is-invalid"
                        : "station-name-input"
                    }
                    value={station.label}
                    onChange={(event) =>
                      onCustomStationLabelChange(station.key, event.target.value)
                    }
                    aria-label="Station name"
                    aria-invalid={Boolean(
                      fieldErrors[`station-${station.key}-label`],
                    )}
                  />
                  {fieldErrors[`station-${station.key}-label`] ? (
                    <small className="field-error">
                      {fieldErrors[`station-${station.key}-label`]}
                    </small>
                  ) : null}
                  <input
                    className={
                      fieldErrors[`station-${station.key}`]
                        ? "is-invalid"
                        : undefined
                    }
                    value={stationSplits[station.key]}
                    onChange={(event) =>
                      onStationChange(station.key, maskTimeInput(event.target.value))
                    }
                    onBlur={(event) =>
                      onStationChange(
                        station.key,
                        normalizeTimeInput(event.target.value),
                      )
                    }
                    inputMode="numeric"
                    placeholder="mm:ss"
                    aria-invalid={Boolean(fieldErrors[`station-${station.key}`])}
                  />
                  {fieldErrors[`station-${station.key}`] ? (
                    <small className="field-error">
                      {fieldErrors[`station-${station.key}`]}
                    </small>
                  ) : null}
                  {stationDefinitions.length > 1 ? (
                    <button
                      className="field-action"
                      type="button"
                      onClick={() => onRemoveCustomStation(station.key)}
                    >
                      Remove
                    </button>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="split-group rounds">
          <div className="rounds__head">
            <h3>{stationDefinitions.length} rounds — run + station</h3>
            <div className="rounds__progress">
              <div className="rounds__dots" aria-hidden="true">
                {stationDefinitions.map((station, index) => {
                  const runValue = (runs[index] ?? "").trim();
                  const stationValue = (stationSplits[station.key] ?? "").trim();
                  const state =
                    runValue && stationValue
                      ? "is-done"
                      : runValue || stationValue
                        ? "is-partial"
                        : "";
                  return (
                    <span
                      className={`rounds__dot ${state}`}
                      key={`dot-${station.key}`}
                    />
                  );
                })}
              </div>
              <span className="rounds__count">
                {roundFilledCount} of {stationDefinitions.length} entered
              </span>
            </div>
          </div>

          <div className="rounds__list">
            {stationDefinitions.map((station, index) => {
              const runValue = runs[index] ?? "";
              const stationValue = stationSplits[station.key] ?? "";
              const filled = Boolean(runValue.trim()) && Boolean(stationValue.trim());
              const runError = fieldErrors[`run-${index}`];
              const stationError = fieldErrors[`station-${station.key}`];

              return (
                <details
                  className={filled ? "round round--filled" : "round"}
                  key={station.key}
                  open={isRoundOpen(index)}
                  onToggle={(event) =>
                    setRoundOpen(index, event.currentTarget.open)
                  }
                >
                  <summary className="round__summary">
                    <span className="round__num">{index + 1}</span>
                    <span className="round__meta">
                      <span className="round__name">{station.label}</span>
                      <span className="round__times">
                        Run{" "}
                        <em className={runValue.trim() ? "is-set" : undefined}>
                          {runValue.trim() || "—"}
                        </em>{" "}
                        · Station{" "}
                        <em className={stationValue.trim() ? "is-set" : undefined}>
                          {stationValue.trim() || "—"}
                        </em>
                      </span>
                    </span>
                    <span className="round__state">{filled ? "Set" : "Enter"}</span>
                  </summary>
                  <div className="round__body">
                    <label className="field">
                      <span>Run {index + 1} (mm:ss)</span>
                      <input
                        className={runError ? "is-invalid" : undefined}
                        value={runValue}
                        onChange={(event) =>
                          onRunChange(index, maskTimeInput(event.target.value))
                        }
                        onBlur={(event) =>
                          onRunChange(index, normalizeTimeInput(event.target.value))
                        }
                        inputMode="numeric"
                        placeholder="mm:ss"
                        aria-invalid={Boolean(runError)}
                      />
                      {runError ? (
                        <small className="field-error">{runError}</small>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>{station.label}</span>
                      <input
                        className={stationError ? "is-invalid" : undefined}
                        value={stationValue}
                        onChange={(event) =>
                          onStationChange(station.key, maskTimeInput(event.target.value))
                        }
                        onBlur={(event) =>
                          onStationChange(
                            station.key,
                            normalizeTimeInput(event.target.value),
                          )
                        }
                        inputMode="numeric"
                        placeholder="mm:ss"
                        aria-invalid={Boolean(stationError)}
                      />
                      {stationError ? (
                        <small className="field-error">{stationError}</small>
                      ) : null}
                    </label>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="btn btn--primary btn--cut btn--block btn--lg"
        type="submit"
        disabled={!hasAnyInput}
      >
        Generate race report
      </button>
      {!hasAnyInput ? (
        <p className="split-form__cta-hint">
          Add your target time and at least one split to generate a report — or use
          Load sample race.
        </p>
      ) : null}
    </form>
  );
}
