import { Analysis, formatTime } from "@/lib/analysis";

type RoxzoneCardProps = {
  analysis: Analysis;
};

export function RoxzoneCard({ analysis }: RoxzoneCardProps) {
  const {
    hasRoxzone,
    roxzoneSeconds,
    roxzonePercent,
    roxzonePerTransitionSeconds,
    stationResults,
  } = analysis;

  if (!hasRoxzone) {
    return (
      <div className="roxzone-card roxzone-card--empty">
        <div className="roxzone-card__head">
          <p className="roxzone-card__eyebrow">Roxzone</p>
          <h3>Reveal your transition time</h3>
        </div>
        <p className="roxzone-card__hint">
          Add your <strong>official finish time</strong> in the race file and Ocht
          will isolate your roxzone, the dead time spent moving between runs and
          stations, where hybrid races are quietly won and lost.
        </p>
      </div>
    );
  }

  const worstStation = [...stationResults].sort((a, b) => b.gap - a.gap)[0];
  const beatsWorstStation =
    worstStation && worstStation.gap > 0 && roxzoneSeconds > worstStation.gap;
  const percentLabel = `${(roxzonePercent * 100).toFixed(1)}%`;

  return (
    <div className="roxzone-card">
      <div className="roxzone-card__head">
        <p className="roxzone-card__eyebrow">Roxzone · transition tax</p>
        <h3>Time lost between segments</h3>
      </div>

      <div className="roxzone-card__hero">
        <strong>{formatTime(roxzoneSeconds)}</strong>
        <span>{percentLabel} of your finish time</span>
      </div>

      <div className="roxzone-card__stats">
        <div>
          <span>Per transition</span>
          <strong>{formatTime(roxzonePerTransitionSeconds)}</strong>
          <small>average dead time</small>
        </div>
        <div>
          <span>Official finish</span>
          <strong>{formatTime(analysis.officialFinishSeconds)}</strong>
          <small>{formatTime(analysis.finishSeconds)} moving</small>
        </div>
      </div>

      <p className="roxzone-card__verdict">
        {beatsWorstStation
          ? `That is more time than your worst station (${worstStation.label}, ${formatTime(
              worstStation.gap,
            )} over benchmark). Sharper transitions are the cheapest time on the course.`
          : "Decisive entries and exits, with gear ready and no standing recovery, are some of the cheapest seconds you can find."}
      </p>
    </div>
  );
}
