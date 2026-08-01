import { useEffect, useMemo, useState } from "react";
import { buildAnalysis } from "@/lib/analysis";
import {
  persistUnlockedArchetypes,
  readUnlockedArchetypes,
} from "@/lib/preferences";
import { getRaceFormatStations } from "@/lib/raceFormats";
import { SavedReport } from "@/lib/reportStorage";

// Keep in sync with the archetype ids/labels returned by buildArchetype()
// in lib/analysis.ts. "unscored" (no-data placeholder) is deliberately
// excluded — it isn't a real collectible archetype.
const ARCHETYPES: { id: string; label: string }[] = [
  { id: "morrigan", label: "The Morrígan" },
  { id: "setanta", label: "Setanta" },
  { id: "cu-chulainn", label: "Cú Chulainn" },
  { id: "brigid", label: "Brigid" },
  { id: "oisin", label: "Oisín" },
  { id: "fionn", label: "Fionn mac Cumhaill" },
  { id: "dagda", label: "The Dagda" },
  { id: "lugh", label: "Lugh" },
  { id: "cormac", label: "Cormac mac Airt" },
];

interface Props {
  reports: SavedReport[];
}

function collectUnlockedArchetypeIds(reports: SavedReport[]): Set<string> {
  const unlocked = new Set<string>();

  for (const report of reports) {
    try {
      const analysis = buildAnalysis(
        report.goal,
        report.targetTime,
        report.level,
        report.runs,
        report.stationSplits,
        report.stationDefinitions ??
          getRaceFormatStations(report.raceFormat ?? "hyrox"),
        report.raceFormat ?? "hyrox",
        report.officialFinishTime ?? "",
      );

      if (analysis.archetype.id !== "unscored") {
        unlocked.add(analysis.archetype.id);
      }
    } catch {
      // Skip reports that fail to analyse (e.g. incomplete legacy data).
    }
  }

  return unlocked;
}

export function ArchetypeAchievements({ reports }: Props) {
  const [persistedIds, setPersistedIds] = useState<string[]>([]);

  useEffect(() => {
    setPersistedIds(readUnlockedArchetypes());
  }, []);

  const liveUnlockedIds = useMemo(
    () => collectUnlockedArchetypeIds(reports),
    [reports],
  );

  useEffect(() => {
    if (liveUnlockedIds.size === 0) {
      return;
    }

    setPersistedIds((current) => {
      const merged = new Set(current);
      let changed = false;

      for (const id of liveUnlockedIds) {
        if (!merged.has(id)) {
          merged.add(id);
          changed = true;
        }
      }

      if (!changed) {
        return current;
      }

      const next = Array.from(merged);

      persistUnlockedArchetypes(next);
      return next;
    });
  }, [liveUnlockedIds]);

  const unlockedIds = useMemo(() => new Set(persistedIds), [persistedIds]);

  return (
    <section className="archetype-achievements">
      <div className="section-heading">
        <p className="eyebrow">Achievements</p>
        <h2>Archetypes collected</h2>
        <p className="archetype-achievements__count">
          {unlockedIds.size} / {ARCHETYPES.length} collected
        </p>
      </div>
      <div className="archetype-achievements__grid">
        {ARCHETYPES.map((archetype) => {
          const isUnlocked = unlockedIds.has(archetype.id);

          return (
            <div
              key={archetype.id}
              className={
                isUnlocked
                  ? "archetype-achievements__badge archetype-achievements__badge--unlocked"
                  : "archetype-achievements__badge archetype-achievements__badge--locked"
              }
            >
              <span className="archetype-achievements__label">
                {isUnlocked ? archetype.label : "???"}
              </span>
              {!isUnlocked && (
                <span className="archetype-achievements__hint">Locked</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
