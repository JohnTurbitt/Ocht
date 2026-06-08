"use client";

import { useEffect, useRef, useState } from "react";
import { EventsList } from "./EventsList";

export function UpcomingEventsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
          <EventsList />
        </div>
      ) : null}
    </div>
  );
}
