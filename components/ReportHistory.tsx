import { useEffect, useMemo, useState } from "react";
import { buildAnalysis, formatTime, levelLabels, parseTime } from "@/lib/analysis";
import { getRaceFormatStations } from "@/lib/raceFormats";
import { SavedReport } from "@/lib/reportStorage";

type ReportHistoryProps = {
  reports: SavedReport[];
  storageLabel: string;
  loading: boolean;
  showComparison?: boolean;
  onLoadReport: (report: SavedReport) => void;
  onDeleteReport: (reportId: string) => void | Promise<void>;
};

function analyzeSavedReport(report: SavedReport) {
  const raceFormat = report.raceFormat ?? "hyrox";

  return buildAnalysis(
    report.goal,
    report.targetTime,
    report.level,
    report.runs,
    report.stationSplits,
    report.stationDefinitions ?? getRaceFormatStations(raceFormat),
    raceFormat,
  );
}

function formatChange(seconds: number) {
  if (seconds === 0) {
    return "No change";
  }

  return `${seconds > 0 ? "-" : "+"}${formatTime(Math.abs(seconds))}`;
}

function describeChange(seconds: number) {
  if (seconds > 0) {
    return "faster";
  }

  if (seconds < 0) {
    return "slower";
  }

  return "unchanged";
}

function describeTargetGapChange(seconds: number) {
  if (seconds > 0) {
    return "less to find";
  }

  if (seconds < 0) {
    return "more to find";
  }

  return "unchanged";
}

function formatTargetGapMetric(
  currentTargetGapSeconds: number,
  targetGapChangeSeconds: number,
  baselineTargetTime: string,
  currentTargetTime: string,
) {
  if (currentTargetGapSeconds <= 0) {
    return {
      value: "On target",
      detail: "no time to find",
    };
  }

  const targetShiftSeconds = parseTime(baselineTargetTime) - parseTime(currentTargetTime);

  if (targetShiftSeconds !== 0) {
    return {
      value: `${formatTime(currentTargetGapSeconds)} left`,
      detail: `target moved ${formatTime(Math.abs(targetShiftSeconds))} ${
        targetShiftSeconds > 0 ? "faster" : "slower"
      }`,
    };
  }

  if (targetGapChangeSeconds === 0) {
    return {
      value: `${formatTime(currentTargetGapSeconds)} left`,
      detail: "same gap as previous",
    };
  }

  return {
    value: `${formatTime(currentTargetGapSeconds)} left`,
    detail: `${formatTime(Math.abs(targetGapChangeSeconds))} ${describeTargetGapChange(
      targetGapChangeSeconds,
    )}`,
  };
}

function describeSignedChange(seconds: number) {
  if (seconds === 0) {
    return "No change";
  }

  return `${seconds > 0 ? "+" : "-"}${formatTime(Math.abs(seconds))}`;
}

function findBiggestStationGain(
  previousAnalysis: ReturnType<typeof analyzeSavedReport>,
  latestAnalysis: ReturnType<typeof analyzeSavedReport>,
) {
  return latestAnalysis.stationResults
    .map((latestStation) => {
      const previousStation = previousAnalysis.stationResults.find(
        (station) => station.key === latestStation.key,
      );

      if (
        !previousStation ||
        previousStation.seconds <= 0 ||
        latestStation.seconds <= 0
      ) {
        return null;
      }

      return {
        label: latestStation.label,
        seconds: previousStation.seconds - latestStation.seconds,
      };
    })
    .filter((station): station is { label: string; seconds: number } =>
      Boolean(station),
    )
    .sort((first, second) => second.seconds - first.seconds)[0];
}

export function ReportHistory({
  reports,
  storageLabel,
  loading,
  showComparison = false,
  onLoadReport,
  onDeleteReport,
}: ReportHistoryProps) {
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const newestReports = useMemo(
    () =>
      [...reports].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      ),
    [reports],
  );
  const progression = useMemo(() => {
    if (newestReports.length < 2) {
      return null;
    }

    const [latest, previous] = newestReports;
    const latestAnalysis = analyzeSavedReport(latest);
    const previousAnalysis = analyzeSavedReport(previous);
    const finishChange =
      latestAnalysis.finishSeconds - previousAnalysis.finishSeconds;
    const targetGapChange =
      latestAnalysis.targetGapSeconds - previousAnalysis.targetGapSeconds;
    const runFadeChange =
      latestAnalysis.runFadeSeconds - previousAnalysis.runFadeSeconds;
    const stationGain = findBiggestStationGain(previousAnalysis, latestAnalysis);
    const topLeakChanged =
      (latestAnalysis.topLeaks[0]?.label ?? "not clear") !==
      (previousAnalysis.topLeaks[0]?.label ?? "not clear");

    return {
      finishChange,
      latest,
      latestAnalysis,
      previous,
      previousAnalysis,
      runFadeChange,
      stationGain,
      targetGapChange,
      topLeakChanged,
    };
  }, [newestReports]);
  const comparison = useMemo(() => {
    if (selectedReportIds.length !== 2) {
      return null;
    }

    const selectedReports = selectedReportIds
      .map((id) => reports.find((report) => report.id === id))
      .filter((report): report is SavedReport => Boolean(report))
      .sort(
        (first, second) =>
          new Date(first.createdAt).getTime() -
          new Date(second.createdAt).getTime(),
      );

    if (selectedReports.length !== 2) {
      return null;
    }

    const [baseline, current] = selectedReports;
    const baselineAnalysis = analyzeSavedReport(baseline);
    const currentAnalysis = analyzeSavedReport(current);
    const finishChange =
      baselineAnalysis.finishSeconds - currentAnalysis.finishSeconds;
    const targetGapChange =
      baselineAnalysis.targetGapSeconds - currentAnalysis.targetGapSeconds;
    const averageRunChange =
      baselineAnalysis.averageRunSeconds - currentAnalysis.averageRunSeconds;
    const runTotalChange =
      baselineAnalysis.totalRunSeconds - currentAnalysis.totalRunSeconds;
    const stationTotalChange =
      baselineAnalysis.totalStationSeconds - currentAnalysis.totalStationSeconds;
    const bestArea =
      Math.abs(runTotalChange) >= Math.abs(stationTotalChange)
        ? "run pacing"
        : "station execution";
    const targetGapMetric = formatTargetGapMetric(
      currentAnalysis.targetGapSeconds,
      targetGapChange,
      baseline.targetTime,
      current.targetTime,
    );

    return {
      averageRunChange,
      baseline,
      baselineAnalysis,
      bestArea,
      current,
      currentAnalysis,
      finishChange,
      targetGapChange,
      targetGapMetric,
    };
  }, [reports, selectedReportIds]);

  useEffect(() => {
    if (!showComparison || newestReports.length < 2 || selectedReportIds.length > 0) {
      return;
    }

    setSelectedReportIds(newestReports.slice(0, 2).map((report) => report.id));
  }, [newestReports, selectedReportIds.length, showComparison]);

  function toggleComparison(reportId: string) {
    setSelectedReportIds((current) => {
      if (current.includes(reportId)) {
        return current.filter((id) => id !== reportId);
      }

      return [reportId, ...current].slice(0, 2);
    });
  }

  return (
    <section className="report-history">
      <div className="section-heading">
        <p className="eyebrow">
          {showComparison ? "Compare reports" : "Previous reports"}
        </p>
        <h2>{showComparison ? "Pick two reports" : storageLabel}</h2>
      </div>

      {loading ? (
        <div className="empty-state">
          <h3>Loading reports</h3>
          <p>Ocht is checking the saved history for this account.</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <h3>No reports saved yet</h3>
          <p>
            Generate a race report and Ocht will keep it in this history before
            there is anything to compare.
          </p>
        </div>
      ) : (
        <>
          {!showComparison && progression ? (
            <div className="history-progression">
              <div className="history-progression__intro">
                <span>Since last report</span>
                <h3>
                  {progression.latest.goal || "Latest report"} vs{" "}
                  {progression.previous.goal || "previous report"}
                </h3>
                <p>
                  Automatic trend check from your two newest saved reports.
                  Signed-in history is stored with your account, not in browser
                  cache.
                </p>
              </div>

              <div className="history-progression__metrics">
                <div>
                  <span>Projected finish</span>
                  <strong>{describeSignedChange(progression.finishChange)}</strong>
                  <small>
                    {progression.finishChange < 0
                      ? "faster than last report"
                      : progression.finishChange > 0
                        ? "slower than last report"
                        : "same projected finish"}
                  </small>
                </div>
                <div>
                  <span>Target gap</span>
                  <strong>{describeSignedChange(progression.targetGapChange)}</strong>
                  <small>
                    {progression.targetGapChange < 0
                      ? "less time to find"
                      : progression.targetGapChange > 0
                        ? "more time to find"
                        : "target pressure unchanged"}
                  </small>
                </div>
                <div>
                  <span>Run fade</span>
                  <strong>{describeSignedChange(progression.runFadeChange)}</strong>
                  <small>
                    {progression.runFadeChange < 0
                      ? "stronger second half"
                      : progression.runFadeChange > 0
                        ? "more fade to control"
                        : "same late-race fade"}
                  </small>
                </div>
                <div>
                  <span>Best station move</span>
                  <strong>
                    {progression.stationGain && progression.stationGain.seconds > 0
                      ? progression.stationGain.label
                      : "No gain yet"}
                  </strong>
                  <small>
                    {progression.stationGain && progression.stationGain.seconds > 0
                      ? `${formatTime(progression.stationGain.seconds)} faster`
                      : "add another cleaner report"}
                  </small>
                </div>
              </div>

              <p className="history-progression__note">
                Top leak{" "}
                {progression.topLeakChanged ? "changed from" : "is still"}{" "}
                <strong>
                  {progression.previousAnalysis.topLeaks[0]?.label ?? "not clear"}
                </strong>
                {progression.topLeakChanged ? (
                  <>
                    {" "}
                    to{" "}
                    <strong>
                      {progression.latestAnalysis.topLeaks[0]?.label ??
                        "not clear"}
                    </strong>
                  </>
                ) : null}
                .
              </p>
            </div>
          ) : null}

          {showComparison ? (
            <div className="history-compare">
              <div>
                <span>Compare reports</span>
                <h3>
                  {comparison
                    ? `${comparison.baseline.goal || "Earlier report"} vs ${
                        comparison.current.goal || "Latest report"
                      }`
                    : "Select two reports"}
                </h3>
                <p>
                  Pick any two saved reports to see what changed in finish time,
                  target pressure, run pace, and biggest leak.
                </p>
              </div>

              {comparison ? (
                <div className="history-compare__panel">
                  <div>
                    <span>Finish change</span>
                    <strong>{formatChange(comparison.finishChange)}</strong>
                    <small>{describeChange(comparison.finishChange)}</small>
                  </div>
                  <div>
                    <span>Target gap</span>
                    <strong>{comparison.targetGapMetric.value}</strong>
                    <small>{comparison.targetGapMetric.detail}</small>
                  </div>
                  <div>
                    <span>Avg run</span>
                    <strong>{formatChange(comparison.averageRunChange)}</strong>
                    <small>{describeChange(comparison.averageRunChange)}</small>
                  </div>
                  <div>
                    <span>Best movement</span>
                    <strong>{comparison.bestArea}</strong>
                    <small>
                      Runs {formatChange(comparison.averageRunChange)} avg
                    </small>
                  </div>
                  <p>
                    Biggest leak changed from{" "}
                    <strong>
                      {comparison.baselineAnalysis.topLeaks[0]?.label ??
                        "not clear"}
                    </strong>{" "}
                    to{" "}
                    <strong>
                      {comparison.currentAnalysis.topLeaks[0]?.label ??
                        "not clear"}
                    </strong>
                    .
                  </p>
                </div>
              ) : (
                <p className="history-compare__empty">
                  {selectedReportIds.length === 0
                    ? "No reports selected."
                    : "Select one more report to compare."}
                </p>
              )}
            </div>
          ) : null}

          <div className="history-list">
            {reports.map((report) => {
              const selected = selectedReportIds.includes(report.id);

              return (
                <article
                  className={selected ? "history-card is-selected" : "history-card"}
                  key={report.id}
                >
                  <div>
                    <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    <h3>{report.goal || "Race report"}</h3>
                    <p>
                      {levelLabels[report.level]} - Top leak:{" "}
                      {report.topLeakLabel || "Not available"}
                    </p>
                  </div>
                  <div className="history-card__metrics">
                    <div>
                      <span>Finish</span>
                      <strong>{formatTime(report.finishSeconds)}</strong>
                    </div>
                    <div>
                      <span>Next target</span>
                      <strong>{formatTime(report.predictedTargetSeconds)}</strong>
                    </div>
                  </div>
                  <div className="history-card__actions">
                    {showComparison ? (
                      <button
                        className={
                          selected
                            ? "button-secondary is-selected"
                            : "button-secondary"
                        }
                        type="button"
                        onClick={() => toggleComparison(report.id)}
                      >
                        {selected ? "Selected" : "Compare"}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => onLoadReport(report)}>
                      Load report
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => void onDeleteReport(report.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
