import { describe, expect, it } from "vitest";
import {
  cloneReportPreset,
  defaultCustomReportPreset,
  defaultReportPreset,
  emptyReportPreset,
  sampleReportPreset,
  tryka500Preset,
  tryka800Preset,
} from "./reportPresets";

describe("report presets", () => {
  it("keeps sample and default presets complete", () => {
    expect(defaultReportPreset.runs).toHaveLength(8);
    expect(sampleReportPreset.runs).toHaveLength(8);
    expect(tryka800Preset.runs).toHaveLength(8);
    expect(tryka500Preset.runs).toHaveLength(8);
    expect(defaultCustomReportPreset.runs).toHaveLength(3);
    expect(Object.values(defaultReportPreset.stationSplits)).toHaveLength(8);
    expect(Object.values(sampleReportPreset.stationSplits)).toHaveLength(8);
    expect(Object.values(tryka800Preset.stationSplits)).toHaveLength(8);
    expect(Object.values(tryka500Preset.stationSplits)).toHaveLength(8);
  });

  it("marks built-in race formats on presets", () => {
    expect(defaultReportPreset.raceFormat).toBe("hyrox");
    expect(tryka800Preset.raceFormat).toBe("tryka800");
    expect(tryka500Preset.raceFormat).toBe("tryka500");
    expect(defaultCustomReportPreset.raceFormat).toBe("custom");
  });

  it("provides an empty preset for clearing the form", () => {
    expect(emptyReportPreset.goal).toBe("");
    expect(emptyReportPreset.targetTime).toBe("");
    expect(emptyReportPreset.runs.every((split) => split === "")).toBe(true);
    expect(
      Object.values(emptyReportPreset.stationSplits).every((split) => split === ""),
    ).toBe(true);
  });

  it("clones nested preset values before editing", () => {
    const clone = cloneReportPreset(sampleReportPreset);

    clone.runs[0] = "9:99";
    clone.stationSplits.ski = "9:99";

    expect(sampleReportPreset.runs[0]).toBe("4:55");
    expect(sampleReportPreset.stationSplits.ski).toBe("4:18");
  });
});
