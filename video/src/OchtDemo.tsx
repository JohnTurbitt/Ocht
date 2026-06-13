import { AbsoluteFill } from "remotion";
import { Scene } from "./Scene";
import { colors } from "./theme";

export function OchtDemo() {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.panel }}>
      <Scene
        screenshot="screenshots/02-hero.png"
        caption="Race split analysis for hybrid athletes"
      />
    </AbsoluteFill>
  );
}

export const TOTAL_DURATION_IN_FRAMES = 210;
