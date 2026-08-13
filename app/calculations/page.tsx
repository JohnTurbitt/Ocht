import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Calculation Method - Ocht",
  description:
    "How Ocht calculates race splits, time leaks, target gaps and training priorities.",
  alternates: { canonical: "/calculations" },
};

export default function CalculationsPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Method</p>
      <h1>How Ocht Calculates Reports</h1>
      <p>
        Ocht uses fixed formulas rather than AI-generated judgement. The same
        inputs produce the same report, which makes the result easier to check,
        compare and explain to a coach.
      </p>

      <h2>Inputs</h2>
      <p>
        The model uses the race format, target time, athlete level, run splits,
        station splits and station order. Custom formats use the same scoring
        approach with the stations entered by the athlete.
      </p>

      <h2>Benchmarks</h2>
      <p>
        Station gaps are measured against the selected athlete level. The level
        changes the benchmark, not the athlete&apos;s entered result. This keeps
        beginner, competitive and elite reports readable without mixing the
        standard.
      </p>

      <h2>Time Leaks</h2>
      <p>
        A leak is the difference between the athlete&apos;s actual split and the
        relevant target or benchmark. Ocht ranks leaks by size,
        recoverability and impact on the total finish time.
      </p>

      <h2>Recoverable Time</h2>
      <p>
        Recoverable time is an estimate of the realistic improvement available
        from a leak. It is intentionally conservative: the goal is a next useful
        training target, not a fantasy best-case race.
      </p>

      <h2>Readiness Score</h2>
      <p>
        Readiness scores are out of 100. Higher means the race profile is closer
        to target, more repeatable or better protected against late-race fade.
        The score is a planning signal, not a medical or fitness diagnosis.
      </p>

      <h2>Training Guidance</h2>
      <p>
        Training priorities are generated from the highest-impact leaks and the
        current target gap. Use them as planning guidance only. Do not use Ocht
        as medical advice, injury advice or a replacement for coaching.
      </p>

      <p className="legal-page__note">
        Calculation model version: beta-2026-05. This page should be updated
        when benchmark tables or scoring weights change.
      </p>
    </main>
  );
}
