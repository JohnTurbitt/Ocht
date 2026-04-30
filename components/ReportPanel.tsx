import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { Analysis, formatTime } from "@/lib/analysis";
import { buildReportExportText } from "@/lib/reportExport";
import { CalculationExplainer } from "./CalculationExplainer";
import { Hint } from "./Hint";
import { TargetSimulator } from "./TargetSimulator";

type ReportPanelProps = {
  analysis: Analysis;
  hasGeneratedReport: boolean;
  fullReportUnlocked: boolean;
  canStartCheckout: boolean;
  billingLoading: boolean;
  showHints: boolean;
  runGainPerKm: string;
  stationGain: string;
  transitionGain: string;
  onStartCheckout: () => void;
  onRunGainPerKmChange: (value: string) => void;
  onStationGainChange: (value: string) => void;
  onTransitionGainChange: (value: string) => void;
};

export function ReportPanel({
  analysis,
  hasGeneratedReport,
  fullReportUnlocked,
  canStartCheckout,
  billingLoading,
  showHints,
  runGainPerKm,
  stationGain,
  transitionGain,
  onStartCheckout,
  onRunGainPerKmChange,
  onStationGainChange,
  onTransitionGainChange,
}: ReportPanelProps) {
  const reportCaptureRef = useRef<HTMLElement>(null);
  const [generatedDate, setGeneratedDate] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const visibleLeaks = fullReportUnlocked
    ? analysis.topLeaks
    : analysis.topLeaks.slice(0, 2);

  const exportText = buildReportExportText(analysis, generatedDate);

  useEffect(() => {
    setGeneratedDate(new Date().toLocaleDateString());
  }, []);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setExportMessage("Report copied.");
      setExportMenuOpen(false);
    } catch {
      setExportMessage("Copy was blocked by the browser.");
    }
  }

  async function shareReport() {
    try {
      const reportBlob = reportCaptureRef.current
        ? await toBlob(reportCaptureRef.current, {
            backgroundColor: "#ffffff",
            cacheBust: true,
            filter: (node) => {
              if (!(node instanceof HTMLElement)) {
                return true;
              }

              return !(
                node.classList.contains("report-actions") ||
                node.classList.contains("report__print")
              );
            },
            pixelRatio: 2,
          })
        : null;

      if (reportBlob && navigator.share) {
        const reportFile = new File([reportBlob], "reprun-race-report.png", {
          type: "image/png",
        });
        const shareData = {
          files: [reportFile],
          text: "RepRun race report",
          title: "RepRun Race Report",
        };

        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setExportMessage("Report image shared.");
          setExportMenuOpen(false);
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: "RepRun Race Report",
          text: exportText,
        });
        setExportMessage("Share sheet opened.");
        setExportMenuOpen(false);
        return;
      }

      await copyReport();
    } catch {
      setExportMessage("Share was cancelled or blocked.");
    }
  }

  function downloadReport() {
    try {
      const reportBlob = new Blob([exportText], { type: "text/plain" });
      const reportUrl = URL.createObjectURL(reportBlob);
      const reportLink = document.createElement("a");

      reportLink.href = reportUrl;
      reportLink.download = "reprun-race-report.txt";
      reportLink.click();
      URL.revokeObjectURL(reportUrl);
      setExportMessage("Report downloaded.");
      setExportMenuOpen(false);
    } catch {
      setExportMessage("Download was blocked by the browser.");
    }
  }

  return (
    <aside className="report" aria-live="polite" ref={reportCaptureRef}>
      <div className="report__header">
        <div className="section-heading">
          <p className="eyebrow">Math Engine</p>
          <h2>{hasGeneratedReport ? "Your race breakdown" : "Live preview"}</h2>
        </div>
        <div className="report-actions report-actions--header">
          {fullReportUnlocked ? (
            <div className="export-menu">
              <button
                type="button"
                onClick={() => setExportMenuOpen((isOpen) => !isOpen)}
                aria-expanded={exportMenuOpen}
              >
                Export
              </button>
              {exportMenuOpen ? (
                <div className="export-menu__options">
                  <button type="button" onClick={() => void copyReport()}>
                    Copy summary
                  </button>
                  <button type="button" onClick={() => void shareReport()}>
                    Share image
                  </button>
                  <button type="button" onClick={downloadReport}>
                    Download .txt
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            className="report__print"
            type="button"
            onClick={() => window.print()}
            disabled={!fullReportUnlocked}
          >
            Print report
          </button>
        </div>
      </div>
      <p className="report__date">
        {generatedDate ? `Generated ${generatedDate} - RepRun` : "RepRun"}
      </p>
      <p className="report__summary">{analysis.report}</p>

      <div className="benchmark-context">
        <div>
          <span>Athlete level</span>
          <strong>{analysis.levelLabel}</strong>
        </div>
        <p>{analysis.stationBenchmarkSummary}</p>
      </div>

      <div className="metric-row metric-row--three">
        <div>
          <span>Average run</span>
          <strong>{analysis.averageRunPace}</strong>
        </div>
        <div>
          <span>
            <Hint enabled={showHints} hint="runFade" term="Run fade" />
          </span>
          <strong>{formatTime(analysis.runFadeSeconds)}/km</strong>
        </div>
        <div>
          <span>
            <Hint enabled={showHints} hint="targetGap" term="Target gap" />
          </span>
          <strong>{formatTime(analysis.targetGapSeconds)}</strong>
        </div>
      </div>

      <h3>
        Top <Hint enabled={showHints} hint="timeLeak" term="time leaks" />
      </h3>
      <div className="leak-list">
        {visibleLeaks.map((leak, index) => (
          <article className="leak-card" key={leak.id}>
            <div>
              <span>#{index + 1}</span>
              <h4>{leak.label}</h4>
              <p>{leak.detail}</p>
            </div>
            <strong>{formatTime(leak.recoverableSeconds)}</strong>
          </article>
        ))}
      </div>

      {!fullReportUnlocked ? (
        <div className="paywall">
          <div>
            <p className="eyebrow">Full report</p>
            <h3>Unlock the complete race plan</h3>
            <p>
              Paid access includes the full leak list, four-week focus,
              station ranking, target simulator, print view, and calculation
              breakdown.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartCheckout}
            disabled={!canStartCheckout || billingLoading}
          >
            {billingLoading
              ? "Opening checkout..."
              : canStartCheckout
                ? "Unlock full report"
                : "Sign in to unlock"}
          </button>
        </div>
      ) : (
        <>
          <p className="helper-text" aria-live="polite">
            {exportMessage ||
              "Export includes the full leak list, training plan, target, and station ranking."}
          </p>

          <h3>Training priorities</h3>
          <ol>
            {analysis.priorities.map((priority) => (
              <li key={priority}>{priority}</li>
            ))}
          </ol>

          <h3>Four-week focus</h3>
          <div className="training-plan">
            {analysis.trainingPlan.map((week) => (
              <article className="training-week" key={week.week}>
                <div className="training-week__header">
                  <span>Week {week.week}</span>
                  <h4>{week.focus}</h4>
                </div>
                <ul>
                  {week.sessions.map((session) => (
                    <li key={session}>{session}</li>
                  ))}
                </ul>
                <p>{week.target}</p>
              </article>
            ))}
          </div>

          <h3>Target simulator</h3>
          <TargetSimulator
            analysis={analysis}
            runGainPerKm={runGainPerKm}
            stationGain={stationGain}
            transitionGain={transitionGain}
            showHints={showHints}
            onRunGainPerKmChange={onRunGainPerKmChange}
            onStationGainChange={onStationGainChange}
            onTransitionGainChange={onTransitionGainChange}
          />

          <h3>Station ranking</h3>
          <p className="helper-text">
            Each station is compared with the {analysis.levelLabel}{" "}
            <Hint enabled={showHints} hint="benchmark" term="benchmark" />.
          </p>
          <div className="station-table">
            {analysis.stationResults.map((station) => (
              <div key={station.key}>
                <span>{station.label}</span>
                <strong>{formatTime(station.gap)} leak</strong>
              </div>
            ))}
          </div>

          <CalculationExplainer analysis={analysis} />
        </>
      )}
    </aside>
  );
}
