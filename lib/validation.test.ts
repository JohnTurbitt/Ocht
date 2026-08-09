import { describe, expect, it } from "vitest";
import { initialRuns, initialStations } from "./analysis";
import {
  isValidTime,
  maskTimeInput,
  normalizeTimeInput,
  validateReportInput,
} from "./validation";

describe("normalizeTimeInput", () => {
  it("normalizes compact time entry into minute and race formats", () => {
    expect(normalizeTimeInput("530")).toBe("5:30");
    expect(normalizeTimeInput("45")).toBe("0:45");
    expect(normalizeTimeInput("12500", "race")).toBe("1:25:00");
    expect(normalizeTimeInput("1:25:00", "race")).toBe("1:25:00");
  });
});

describe("maskTimeInput", () => {
  it("builds mm:ss right-to-left as digits are typed", () => {
    expect(maskTimeInput("")).toBe("");
    expect(maskTimeInput("5")).toBe("0:05");
    expect(maskTimeInput("53")).toBe("0:53");
    expect(maskTimeInput("530")).toBe("5:30");
    expect(maskTimeInput("1230")).toBe("12:30");
  });

  it("builds h:mm:ss for the race format", () => {
    expect(maskTimeInput("125", "race")).toBe("1:25");
    expect(maskTimeInput("12500", "race")).toBe("1:25:00");
    expect(maskTimeInput("112500", "race")).toBe("11:25:00");
  });

  it("is idempotent on an already-formatted value and strips stray chars", () => {
    expect(maskTimeInput("5:30")).toBe("5:30");
    expect(maskTimeInput("1:25:00", "race")).toBe("1:25:00");
    expect(maskTimeInput("5:3")).toBe("0:53");
  });

  it("keeps only the most recent digits past the cap", () => {
    expect(maskTimeInput("123456")).toBe("34:56");
    expect(maskTimeInput("11234567", "race")).toBe("23:45:67");
  });
});

describe("isValidTime", () => {
  it("accepts seconds, minute splits and race times", () => {
    expect(isValidTime("330")).toBe(true);
    expect(isValidTime("5:30")).toBe(true);
    expect(isValidTime("1:25:00")).toBe(true);
  });

  it("rejects empty, malformed and impossible times", () => {
    expect(isValidTime("")).toBe(false);
    expect(isValidTime("abc")).toBe(false);
    expect(isValidTime("5:99")).toBe(false);
    expect(isValidTime("1:99:00")).toBe(false);
  });
});

describe("validateReportInput", () => {
  it("returns valid when all report inputs are valid", () => {
    const result = validateReportInput({
      targetTime: "1:25:00",
      runs: initialRuns,
      stationSplits: initialStations,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.fieldErrors).toEqual({});
  });

  it("reports target, run and station errors", () => {
    const result = validateReportInput({
      targetTime: "1:99:00",
      runs: ["", ...initialRuns.slice(1)],
      stationSplits: {
        ...initialStations,
        wallBalls: "bad",
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Enter a valid target time, for example 1:25:00.",
    );
    expect(result.errors).toContain("Run 1 needs a valid time, for example 5:30.");
    expect(result.errors).toContain(
      "Wall balls needs a valid time, for example 5:00.",
    );
    expect(result.fieldErrors.targetTime).toBe(
      "Enter a valid target time, for example 1:25:00.",
    );
    expect(result.fieldErrors["run-0"]).toBe("Use a valid time like 5:30.");
    expect(result.fieldErrors["station-wallBalls"]).toBe(
      "Use a valid time like 5:00.",
    );
  });
});
