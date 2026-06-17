import { formatTime, parseTime } from "@/lib/analysis";
import { SavedReport } from "@/lib/reportStorage";

interface Props {
  reports: SavedReport[];
}

const STATION_LABELS: Record<string, string> = {
  ski: "Ski Erg",
  sledPush: "Sled Push",
  sledPull: "Sled Pull",
  burpees: "Burpee Broad Jump",
  row: "Rowing",
  farmers: "Farmer's Carry",
  lunges: "Sandbag Lunges",
  wallBalls: "Wall Balls",
};

type PREntry = {
  key: string;
  label: string;
  seconds: number;
  createdAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PersonalRecords({ reports }: Props) {
  if (reports.length === 0) {
    return null;
  }

  // Compute station PRs
  const stationPRMap = new Map<string, PREntry>();

  for (const report of reports) {
    for (const [key, label] of Object.entries(STATION_LABELS)) {
      const raw = report.stationSplits[key];
      if (!raw || raw.trim() === "") continue;

      const seconds = parseTime(raw);
      if (seconds <= 0) continue;

      const existing = stationPRMap.get(key);
      if (!existing || seconds < existing.seconds) {
        stationPRMap.set(key, { key, label, seconds, createdAt: report.createdAt });
      }
    }
  }

  const stationPRs = Array.from(stationPRMap.values());

  // Compute run PR
  let runPR: { seconds: number; createdAt: string } | null = null;

  for (const report of reports) {
    for (const run of report.runs) {
      if (!run || run.trim() === "") continue;
      const seconds = parseTime(run);
      if (seconds <= 0) continue;
      if (!runPR || seconds < runPR.seconds) {
        runPR = { seconds, createdAt: report.createdAt };
      }
    }
  }

  if (stationPRs.length === 0 && runPR === null) {
    return null;
  }

  return (
    <section className="personal-records">
      <div className="section-heading">
        <p className="eyebrow">Records</p>
        <h2>Personal bests</h2>
      </div>
      <div className="personal-records__grid">
        {stationPRs.map((pr) => (
          <div key={pr.key} className="personal-records__card">
            <span className="personal-records__label">{pr.label}</span>
            <strong className="personal-records__time">{formatTime(pr.seconds)}</strong>
            <em className="personal-records__date">{formatDate(pr.createdAt)}</em>
          </div>
        ))}
        {runPR && (
          <div className="personal-records__card personal-records__card--run">
            <span className="personal-records__label">Best run split</span>
            <strong className="personal-records__time">{formatTime(runPR.seconds)}</strong>
            <em className="personal-records__date">{formatDate(runPR.createdAt)}</em>
          </div>
        )}
      </div>
    </section>
  );
}
