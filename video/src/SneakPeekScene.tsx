import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { KineticCaption } from "./KineticCaption";
import { PAPER } from "./brandMark";

type SneakPeekSceneProps = {
  screenshot: string;
  caption: string;
};

export function SneakPeekScene({ screenshot, caption }: SneakPeekSceneProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, durationInFrames], [0, -16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <Img
        src={staticFile(screenshot)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top center",
          transform: `scale(${scale}) translateY(${translateY}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${PAPER}f2 0%, ${PAPER}00 32%)`,
        }}
      />
      <KineticCaption text={caption} />
    </AbsoluteFill>
  );
}
