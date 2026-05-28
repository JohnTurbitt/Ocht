"use client";

import { useEffect, useRef, useState } from "react";
import { upcomingEvents } from "@/lib/upcomingEvents";

export function UpcomingEventsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const featuredEvents = upcomingEvents.slice(0, 5);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="events-menu" ref={menuRef}>
      <button
        className="events-menu__trigger"
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
      >
        Events
        <span aria-hidden="true" />
      </button>
      {open ? (
        <div className="events-menu__panel">
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
        </div>
      ) : null}
    </div>
  );
}
