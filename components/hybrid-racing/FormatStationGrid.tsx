type FormatStation = {
  label: string;
  description: string;
};

type FormatStationGridProps = {
  heading: string;
  stations: FormatStation[];
};

export function FormatStationGrid({ heading, stations }: FormatStationGridProps) {
  return (
    <section className="format-station-grid">
      <h2>{heading}</h2>
      <div className="format-station-grid__grid">
        {stations.map((station, index) => (
          <div className="format-station-grid__item" key={station.label}>
            <span className="format-station-grid__index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3>{station.label}</h3>
            <p>{station.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
