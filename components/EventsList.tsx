import { upcomingEvents } from "@/lib/upcomingEvents";

export function EventsList() {
  const featuredEvents = upcomingEvents.slice(0, 5);

  return (
    <>
      <div className="events-menu__header">
        <p className="eyebrow">Upcoming races</p>
        <strong>HYROX + TRYKA</strong>
      </div>
      <div className="events-menu__list">
        {featuredEvents.map((event) => (
          <a href={event.url} key={event.id} target="_blank" rel="noreferrer">
            <span
              className={`events-menu__badge events-menu__badge--${event.series.toLowerCase()}`}
            >
              {event.series}
            </span>
            <div>
              <strong>{event.name}</strong>
              <p>
                {event.location}, {event.country}
              </p>
              <small>
                {event.dateLabel} - {event.status}
              </small>
            </div>
          </a>
        ))}
      </div>
      <p className="events-menu__source">
        Dates are manually curated from public event pages.
      </p>
    </>
  );
}
