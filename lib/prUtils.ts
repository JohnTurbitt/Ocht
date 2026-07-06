import { SavedReport } from "@/lib/reportStorage";
import { parseTime } from "@/lib/analysis";

export type PRMap = Map<string, { seconds: number; createdAt: string }>;

export function buildPRMap(reports: SavedReport[], stationKeys: string[]): PRMap {
  const map: PRMap = new Map();
  for (const report of reports) {
    for (const key of stationKeys) {
      const raw = report.stationSplits[key as keyof typeof report.stationSplits];
      if (!raw?.trim()) continue;
      const seconds = parseTime(raw);
      if (seconds <= 0) continue;
      const existing = map.get(key);
      if (!existing || seconds < existing.seconds) {
        map.set(key, { seconds, createdAt: report.createdAt });
      }
    }
  }
  return map;
}
