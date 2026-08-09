"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTime } from "@/lib/analysis";
import { buildProgressSeries, type ProgressPoint } from "@/lib/progress";
import { SavedReport } from "@/lib/reportStorage";

type ProgressDashboardProps = {
  reports: SavedReport[];
};

type MetricId = "finish" | "readiness" | "fade" | "gap";

const METRICS: {
  id: MetricId;
  label: string;
  key: keyof ProgressPoint;
  kind: "time" | "score";
}[] = [
  { id: "finish", label: "Finish", key: "finishSeconds", kind: "time" },
  { id: "readiness", label: "Readiness", key: "readiness", kind: "score" },
  { id: "fade", label: "Run fade", key: "runFadeSeconds", kind: "time" },
  { id: "gap", label: "Target gap", key: "targetGapSeconds", kind: "time" },
];

function formatValue(kind: "time" | "score", value: number) {
  return kind === "time" ? formatTime(value) : `${Math.round(value)}`;
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ProgressDashboard({ reports }: ProgressDashboardProps) {
  const series = useMemo(() => buildProgressSeries(reports), [reports]);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [metricId, setMetricId] = useState<MetricId>("finish");

  if (series.groups.length === 0) {
    return null;
  }

  const summary =
    series.groups.find((group) => group.key === groupKey) ?? series.groups[0];

  const metric = METRICS.find((item) => item.id === metricId) ?? METRICS[0];
  const chartData = summary.points.map((point) => ({
    label: dateLabel(point.createdAt),
    value: point[metric.key] as number,
  }));
  const improvement = summary.improvementVsFirstSeconds;
  const offPb = summary.latest.finishSeconds - summary.pb.finishSeconds;

  return (
    <section className="progress-dashboard" aria-label="Progress">
      <div className="progress-dashboard__head">
        <div className="section-heading">
          <p className="eyebrow">Progress</p>
          <h2>Your trend</h2>
        </div>
        {series.groups.length > 1 ? (
          <div className="progress-filter" role="tablist" aria-label="Race format">
            {series.groups.map((group) => (
              <button
                key={group.key}
                type="button"
                className={group.key === summary.key ? "is-active" : undefined}
                onClick={() => setGroupKey(group.key)}
              >
                {group.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="progress-headline">
        <div className="progress-stat progress-stat--pb">
          <span>Personal best</span>
          <strong>{formatTime(summary.pb.finishSeconds)}</strong>
          <em>{summary.label}</em>
        </div>
        <div className="progress-stat">
          <span>Latest</span>
          <strong>{formatTime(summary.latest.finishSeconds)}</strong>
          <em>
            {summary.latestIsPb
              ? "New personal best"
              : `${formatTime(offPb)} off your PB`}
          </em>
        </div>
        <div className="progress-stat">
          <span>Since first</span>
          <strong>
            {improvement === 0
              ? "—"
              : `${improvement > 0 ? "−" : "+"}${formatTime(Math.abs(improvement))}`}
          </strong>
          <em>
            {improvement > 0
              ? "faster overall"
              : improvement < 0
                ? "slower overall"
                : "your first report"}
          </em>
        </div>
        <div className="progress-stat">
          <span>Readiness</span>
          <strong>
            {summary.latest.readiness}
            <small>/100</small>
          </strong>
          <em>{summary.count} reports</em>
        </div>
      </div>

      {summary.count >= 2 ? (
        <div className="progress-trend">
          <div className="progress-trend__toggle" role="tablist" aria-label="Metric">
            {METRICS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === metricId ? "is-active" : undefined}
                onClick={() => setMetricId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="progress-trend__chart">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 16, bottom: 4, left: 4 }}
              >
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line)" }}
                />
                <YAxis
                  width={52}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatValue(metric.kind, Number(value))}
                  domain={metric.kind === "score" ? [0, 100] : ["auto", "auto"]}
                />
                <Tooltip
                  cursor={{ stroke: "var(--line)" }}
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    color: "var(--ink)",
                  }}
                  labelStyle={{ color: "var(--muted)" }}
                  formatter={(value) => [
                    formatValue(metric.kind, Number(value)),
                    metric.label,
                  ]}
                />
                {metric.id === "finish" && summary.latest.targetSeconds > 0 ? (
                  <ReferenceLine
                    y={summary.latest.targetSeconds}
                    stroke="var(--teal)"
                    strokeDasharray="4 4"
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--lime)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--lime)" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="progress-dashboard__hint">
          Log another {summary.label} report to unlock your trend line.
        </p>
      )}
    </section>
  );
}
