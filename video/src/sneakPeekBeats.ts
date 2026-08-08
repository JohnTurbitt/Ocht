export type SneakPeekBeat = {
  id: string;
  screenshot: string;
  caption: string;
  durationInFrames: number;
};

export const SNEAK_PEEK_BOOKEND_FRAMES = 60;

export const sneakPeekBeats: SneakPeekBeat[] = [
  {
    id: "hero",
    screenshot: "screenshots/sneak-peek/01-hero.png",
    caption: "Know exactly where you lose time",
    durationInFrames: 90,
  },
  {
    id: "strava-connect",
    screenshot: "screenshots/sneak-peek/02-strava-connect.png",
    caption: "Connect Strava",
    durationInFrames: 90,
  },
  {
    id: "format-picker",
    screenshot: "screenshots/sneak-peek/03-format-picker.png",
    caption: "Hyrox. Tryka. Or build your own.",
    durationInFrames: 90,
  },
  {
    id: "split-form",
    screenshot: "screenshots/sneak-peek/04-split-form.png",
    caption: "Log your splits",
    durationInFrames: 90,
  },
  {
    id: "results-archetype",
    screenshot: "screenshots/sneak-peek/05-results-archetype.png",
    caption: "Meet your archetype",
    durationInFrames: 120,
  },
  {
    id: "blueprint-leaks",
    screenshot: "screenshots/sneak-peek/06-blueprint-leaks.png",
    caption: "Find your leaks",
    durationInFrames: 120,
  },
  {
    id: "training-simulator",
    screenshot: "screenshots/sneak-peek/07-training-simulator.png",
    caption: "Your 4-week focus",
    durationInFrames: 90,
  },
  {
    id: "premium-unlock",
    screenshot: "screenshots/sneak-peek/08-premium-unlock.png",
    caption: "Unlock the full report",
    durationInFrames: 90,
  },
];

export const SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES =
  SNEAK_PEEK_BOOKEND_FRAMES * 2 +
  sneakPeekBeats.reduce((total, beat) => total + beat.durationInFrames, 0);
