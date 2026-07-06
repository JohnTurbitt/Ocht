import { formatTime } from "@/lib/analysis";
import { SavedReport } from "@/lib/reportStorage";
import { buildPRMap } from "@/lib/prUtils";

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

  const latestDate = latestReportDate(reports);
  const prMap = buildPRMap(reports, Object.keys(STATION_LABELS));
  const stationPRs = Array.from(prMap.entries()).map(([key, pr]) => ({
    key,
    label: STATION_LABELS[key] ?? key,
    abbrev: STATION_ABBREV[key] ?? key.slice(0, 2).toUpperCase(),
    seconds: pr.seconds,
    createdAt: pr.createdAt,
    isNew: latestDate !== null && pr.createdAt === latestDate,
  }));

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
              {pr.isNew && <span role="img" className="personal-records__pulse-dot" aria-label="New personal record" />}
              <span className="personal-records__meta">{formatDate(pr.createdAt)}</span>
            </div>
            <strong className="personal-records__time">{formatTime(pr.seconds)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
