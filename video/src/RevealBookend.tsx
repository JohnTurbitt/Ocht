import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LIME, MUTED, PAPER, ShieldMark } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["900"] });
const mono = loadMonoFont("normal", { weights: ["400"] });

const SHIELD_SIZE = 150;

type RevealBookendProps = {
  mode: "intro" | "outro";
};

export function RevealBookend({ mode }: RevealBookendProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const shieldOpacity =
    mode === "intro"
      ? interpolate(frame, [0, durationInFrames * 0.7], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const shieldScale =
    mode === "intro"
      ? interpolate(frame, [0, durationInFrames * 0.7], [0.85, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const glowOpacity =
    mode === "intro"
      ? interpolate(frame, [0, durationInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const taglineOpacity =
    mode === "outro"
      ? interpolate(frame, [durationInFrames * 0.3, durationInFrames * 0.8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

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
      <ShieldMark
        size={SHIELD_SIZE}
        displayFontFamily={display.fontFamily}
        opacity={shieldOpacity}
        scale={shieldScale}
      />
      {mode === "outro" ? (
        <p
          style={{
            marginTop: 32,
            fontFamily: mono.fontFamily,
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: MUTED,
            opacity: taglineOpacity,
          }}
        >
          ocht.app
        </p>
      ) : null}
    </AbsoluteFill>
  );
}
