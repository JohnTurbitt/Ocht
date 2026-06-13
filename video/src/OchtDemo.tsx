import { AbsoluteFill } from "remotion";
import { LogoScene } from "./LogoScene";
import { colors } from "./theme";

export function OchtDemo() {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.panel }}>
      <LogoScene tagline="Train smarter, race faster" />
    </AbsoluteFill>
  );
}

export const TOTAL_DURATION_IN_FRAMES = 150;
