import { FormEvent } from "react";
import { PremiumBadge } from "@/components/PremiumBadge";
import {
  Level,
  Station,
  StationKey,
  levelLabels,
} from "@/lib/analysis";
import { CustomTemplate } from "@/lib/customTemplates";
import { RaceFormat, raceFormatOptions } from "@/lib/raceFormats";
import { normalizeTimeInput } from "@/lib/validation";

type SplitFormProps = {
  raceFormat: RaceFormat;
  fullReportUnlocked: boolean;
  goal: string;
  targetTime: string;
  level: Level;
  runs: string[];
  stationDefinitions: Station[];
  stationSplits: Record<StationKey, string>;
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
  onLevelChange: (value: Level) => void;
  onRunChange: (index: number, value: string) => void;
  onStationChange: (key: StationKey, value: string) => void;
  onLoadSample: () => void;
  onResetDefaults: () => void;
  onClearForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SplitForm({
  raceFormat,
  fullReportUnlocked,
  goal,
  targetTime,
  level,
  runs,
  stationDefinitions,
  stationSplits,
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
  onLevelChange,
  onRunChange,
  onStationChange,
  onLoadSample,
  onResetDefaults,
  onClearForm,
  onSubmit,
}: SplitFormProps) {
  const isCustom = raceFormat === "custom";

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
        </div>
      </div>

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
            onChange={(event) => onTargetTimeChange(event.target.value)}
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

      <label className="field field--wide">
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

      <div className="split-group">
        <h3>Run splits</h3>
        <div className="split-grid">
          {runs.map((split, index) => (
            <label className="field" key={`run-${index + 1}`}>
              <span>Run {index + 1}</span>
              <input
                className={fieldErrors[`run-${index}`] ? "is-invalid" : undefined}
                value={split}
                onChange={(event) => onRunChange(index, event.target.value)}
                onBlur={(event) =>
                  onRunChange(index, normalizeTimeInput(event.target.value))
                }
                inputMode="numeric"
                placeholder="5:30"
                aria-invalid={Boolean(fieldErrors[`run-${index}`])}
              />
              {fieldErrors[`run-${index}`] ? (
                <small className="field-error">
                  {fieldErrors[`run-${index}`]}
                </small>
              ) : null}
              {isCustom && runs.length > 1 ? (
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
              {isCustom ? (
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
              ) : (
                <span>{station.label}</span>
              )}
              {fieldErrors[`station-${station.key}-label`] ? (
                <small className="field-error">
                  {fieldErrors[`station-${station.key}-label`]}
                </small>
              ) : null}
              <input
                className={
                  fieldErrors[`station-${station.key}`] ? "is-invalid" : undefined
                }
                value={stationSplits[station.key]}
                onChange={(event) =>
                  onStationChange(station.key, event.target.value)
                }
                onBlur={(event) =>
                  onStationChange(
                    station.key,
                    normalizeTimeInput(event.target.value),
                  )
                }
                inputMode="numeric"
                placeholder="5:00"
                aria-invalid={Boolean(fieldErrors[`station-${station.key}`])}
              />
              {fieldErrors[`station-${station.key}`] ? (
                <small className="field-error">
                  {fieldErrors[`station-${station.key}`]}
                </small>
              ) : null}
              {isCustom && stationDefinitions.length > 1 ? (
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

      <button type="submit">Generate race report</button>
    </form>
  );
}
