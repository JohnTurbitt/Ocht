import { EventsList } from "./EventsList";

type EventsSheetProps = {
  onClose: () => void;
};

export function EventsSheet({ onClose }: EventsSheetProps) {
  return (
    <div
      className="events-sheet"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="events-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Upcoming races"
      >
        <button
          className="events-sheet__close"
          type="button"
          onClick={onClose}
          aria-label="Close events"
        >
          ×
        </button>
        <EventsList />
      </section>
    </div>
  );
}
