import { describe, expect, it } from "vitest";
import {
  getRaceFormatOption,
  getRaceFormatStations,
  isRaceFormat,
  raceFormatOptions,
} from "./raceFormats";

describe("race formats", () => {
  it("defines HYROX and TRYKA built-in formats", () => {
    expect(raceFormatOptions.map((option) => option.id)).toEqual([
      "hyrox",
      "tryka800",
      "tryka500",
    ]);
  });

  it("keeps each built-in format compatible with the current eight-station engine", () => {
    expect(getRaceFormatStations("hyrox")).toHaveLength(8);
    expect(getRaceFormatStations("tryka800")).toHaveLength(8);
    expect(getRaceFormatStations("tryka500")).toHaveLength(8);
  });

  it("uses TRYKA station labels for TRYKA presets", () => {
    expect(getRaceFormatOption("tryka800").stations[2].label).toBe(
      "Ram Thrusters 60 reps",
    );
    expect(getRaceFormatOption("tryka500").runLabel).toBe("500m run");
  });

  it("validates race format ids", () => {
    expect(isRaceFormat("tryka800")).toBe(true);
    expect(isRaceFormat("custom")).toBe(true);
    expect(isRaceFormat("unknown")).toBe(false);
  });
});
