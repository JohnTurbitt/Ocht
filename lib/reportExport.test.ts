import { describe, expect, it } from "vitest";
import { buildAnalysis, initialRuns, initialStations } from "./analysis";
import { buildReportExportText } from "./reportExport";

describe("buildReportExportText", () => {
  it("includes paid report sections in a coach-friendly text export", () => {
    const analysis = buildAnalysis(
      "Sub 1:25",
      "1:25:00",
      "competitive",
      initialRuns,
      initialStations,
    );
    const exportText = buildReportExportText(analysis, "30/04/2026");

    expect(exportText).toContain("RepRun Race Report");
    expect(exportText).toContain("Athlete level: Competitive");
    expect(exportText).toContain("Top Time Leaks");
    expect(exportText).toContain("Training Priorities");
    expect(exportText).toContain("Four-Week Focus");
    expect(exportText).toContain("Station Ranking");
  });
});
