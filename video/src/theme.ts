import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";

const display = loadDisplayFont("normal", { weights: ["700", "900"] });
const mono = loadMonoFont("normal", { weights: ["500"] });

export const fonts = {
  display: display.fontFamily,
  mono: mono.fontFamily,
} as const;

export const colors = {
  lime: "#c8ff2e",
  panel: "#0e1914",
  surface: "#14241d",
  ink: "#f4f7ef",
  line: "#284237",
  teal: "#60c878",
  badgeInk: "#0b120f",
} as const;
