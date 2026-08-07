import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LIME, MUTED, PAPER, RingMark, ShieldMark } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["900"] });
const mono = loadMonoFont("normal", { weights: ["400"] });

const RING_SIZE = 460;
const SHIELD_SIZE = 150;

// Angle stays at 0 until ACCEL_START_FRAME, then grows as angle = K * t^2 —
// a true constant-acceleration ramp (not an eased/bezier approximation), so
// the ring visibly "picks up speed like a car" rather than snapping into a spin.
const ACCEL_START_FRAME = 99;
const ACCEL_K = 0.05;

export function InstagramReveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shieldOpacity = interpolate(frame, [fps * 0.3, fps * 2.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shieldScale = interpolate(frame, [fps * 0.3, fps * 2.4], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(frame, [fps * 2.6, fps * 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ringOpacity = interpolate(frame, [fps * 3, fps * 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const accelT = Math.max(0, frame - ACCEL_START_FRAME);
  const ringRotation = ACCEL_K * accelT * accelT;

  const identityOpacity = interpolate(frame, [fps * 4.4, fps * 5.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const identityTranslateY = interpolate(frame, [fps * 4.4, fps * 5.8], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: PAPER,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${LIME}55 0%, ${LIME}00 70%)`,
          filter: "blur(50px)",
          opacity: glowOpacity,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: RING_SIZE,
          height: RING_SIZE,
        }}
      >
        <RingMark size={RING_SIZE} opacity={ringOpacity} rotationDeg={ringRotation} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <ShieldMark
            size={SHIELD_SIZE}
            displayFontFamily={display.fontFamily}
            opacity={shieldOpacity}
            scale={shieldScale}
          />
        </div>
      </div>

      <p
        style={{
          marginTop: 32,
          fontFamily: mono.fontFamily,
          fontWeight: 400,
          fontSize: 22,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: MUTED,
          opacity: identityOpacity,
          transform: `translateY(${identityTranslateY}px)`,
        }}
      >
        8 stations · 8 runs · 1 race
      </p>
    </AbsoluteFill>
  );
}

export const INSTAGRAM_REVEAL_DURATION_IN_FRAMES = 300;
export const INSTAGRAM_REVEAL_FPS = 30;
