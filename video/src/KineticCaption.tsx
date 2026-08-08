import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LIME, PAPER } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["700", "900"] });

type KineticCaptionProps = {
  text: string;
};

export function KineticCaption({ text }: KineticCaptionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, fps * 0.25, durationInFrames - fps * 0.25, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const translateY = interpolate(frame, [0, fps * 0.25], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "8%",
        display: "flex",
        justifyContent: "center",
        padding: "0 6%",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontFamily: display.fontFamily,
          fontWeight: 900,
          fontSize: 56,
          lineHeight: 1.1,
          textAlign: "center",
          color: LIME,
          textShadow: `0 4px 24px ${PAPER}`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
