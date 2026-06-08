import { Analysis } from "@/lib/analysis";
import { OchtShield } from "./OchtShield";

type AthleteArchetypeCardProps = {
  analysis: Analysis;
};

const SCORE_LABELS: { key: keyof Analysis["archetype"]["scores"]; label: string }[] =
  [
    { key: "engine", label: "Run engine" },
    { key: "strength", label: "Strength" },
    { key: "durability", label: "Durability" },
    { key: "consistency", label: "Consistency" },
  ];

function scoreTier(score: number) {
  if (score >= 75) {
    return "high";
  }

  if (score >= 50) {
    return "mid";
  }

  return "low";
}

export function AthleteArchetypeCard({ analysis }: AthleteArchetypeCardProps) {
  const { archetype } = analysis;

  return (
    <div className="archetype-card">
      <div className="archetype-card__head">
        <div className="archetype-card__mark">
          <OchtShield size={30} />
        </div>
        <div>
          <p className="archetype-card__eyebrow">Athlete archetype</p>
          <h3 className="archetype-card__name">{archetype.label}</h3>
          <p className="archetype-card__tagline">{archetype.tagline}</p>
        </div>
      </div>

      <p className="archetype-card__desc">{archetype.description}</p>

      <div className="archetype-card__scores">
        {SCORE_LABELS.map(({ key, label }) => {
          const score = archetype.scores[key];

          return (
            <div className="archetype-score" key={key}>
              <div className="archetype-score__head">
                <span>{label}</span>
                <strong>{score}</strong>
              </div>
              <div className="archetype-score__track">
                <div
                  className={`archetype-score__fill archetype-score__fill--${scoreTier(
                    score,
                  )}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {archetype.traits.length > 0 ? (
        <div className="archetype-card__traits">
          {archetype.traits.map((trait) => (
            <span key={trait}>{trait}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
