import { upcomingEvents } from "@/lib/upcomingEvents";

function daysUntil(startDate: string): number {
  const now = new Date(new Date().toISOString().split("T")[0]);
  const target = new Date(startDate);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function EventsList() {
  const pastCutoff = new Date().toISOString().slice(0, 10);
  const upcoming = upcomingEvents.filter((e) => e.startDate >= pastCutoff);
  const past = upcomingEvents.filter((e) => e.startDate < pastCutoff).slice(-2);
  const displayEvents = [...upcoming.slice(0, 6), ...past];

  return (
    <>
      <div className="events-menu__header">
        <p className="eyebrow">Race calendar</p>
        <strong>HYROX + TRYKA</strong>
      </div>
      <div className="events-timeline">
        {displayEvents.map((event) => {
          const days = daysUntil(event.startDate);
          const isPast = days < 0;
          return (
            <a href={event.url} key={event.id} target="_blank" rel="noreferrer"
              className={`events-timeline__item${isPast ? " events-timeline__item--past" : ""}`}>
              <div className="events-timeline__spine" aria-hidden="true">
                <span className="events-timeline__node" />
              </div>
              <div className="events-timeline__card">
                <div className="events-timeline__card-head">
                  <span className={`events-menu__badge events-menu__badge--${event.series.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>{event.series}</span>
                  {!isPast && <span className="events-timeline__countdown">{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}</span>}
                </div>
                <strong className="events-timeline__name">{event.name}</strong>
                <p className="events-timeline__location">{event.location}, {event.country}</p>
                <small className="events-timeline__meta">{event.dateLabel} · {event.status}</small>
              </div>
            </a>
          );
        })}
      </div>
      <p className="events-menu__source">Dates are manually curated from public event pages.</p>
    </>
  );
}
