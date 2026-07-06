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

const STATION_ABBREV: Record<string, string> = {
  ski:"SK", sledPush:"SP", sledPull:"SL", burpees:"BB",
  row:"RW", farmers:"FC", lunges:"LG", wallBalls:"WB",
};

type PREntry = {
  key: string; label: string; abbrev: string;
  seconds: number; createdAt: string; isNew: boolean;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function latestReportDate(reports: SavedReport[]): string | null {
  if (reports.length === 0) return null;
  return reports.reduce((l, r) => r.createdAt > l ? r.createdAt : l, reports[0].createdAt);
}

export function PersonalRecords({ reports }: Props) {
  if (reports.length === 0) {
    return null;
  }

  // Compute station PRs
  const stationPRMap = new Map<string, PREntry>();
  const latestDate = latestReportDate(reports);

  for (const report of reports) {
    for (const [key, label] of Object.entries(STATION_LABELS)) {
      const raw = report.stationSplits[key];
      if (!raw || raw.trim() === "") continue;

      const seconds = parseTime(raw);
      if (seconds <= 0) continue;

      const existing = stationPRMap.get(key);
      if (!existing || seconds < existing.seconds) {
        stationPRMap.set(key, {
          key, label,
          abbrev: STATION_ABBREV[key] ?? key.slice(0, 2).toUpperCase(),
          seconds, createdAt: report.createdAt,
          isNew: latestDate !== null && report.createdAt === latestDate,
        });
      }
    }
  }

  const stationPRs = Array.from(stationPRMap.values());

  if (stationPRs.length === 0) {
    return null;
  }

  const newCount = stationPRs.filter((p) => p.isNew).length;
  return (
    <section className="personal-records personal-records--list">
      <div className="section-heading">
        <p className="eyebrow">Records</p>
        <div className="personal-records__list-header">
          <h2>Personal bests</h2>
          {newCount > 0 && <span className="personal-records__new-chip" aria-label={`${newCount} new personal records`}>{newCount} new</span>}
        </div>
      </div>
      <div className="personal-records__list">
        {stationPRs.map((pr) => (
          <div key={pr.key} className="personal-records__row">
            <span className="personal-records__icon" aria-hidden="true">{pr.abbrev}</span>
            <div className="personal-records__row-body">
              <span className="personal-records__name">{pr.label}</span>
              {pr.isNew && <span className="personal-records__pulse-dot" aria-label="New personal record" />}
              <span className="personal-records__meta">{formatDate(pr.createdAt)}</span>
            </div>
            <strong className="personal-records__time">{formatTime(pr.seconds)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
