import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts } from "./theme";

type SceneProps = {
  screenshot: string;
  caption?: string;
};

export function Scene({ screenshot, caption }: SceneProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, durationInFrames], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const captionOpacity = interpolate(
    frame,
    [0, fps * 0.5, durationInFrames - fps * 0.5, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const captionTranslate = interpolate(frame, [0, fps * 0.5], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${colors.surface} 0%, ${colors.panel} 70%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 360,
          height: 780,
          borderRadius: 48,
          border: `6px solid ${colors.line}`,
          overflow: "hidden",
          boxShadow: `0 0 120px ${colors.lime}33`,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          background: colors.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.mono,
          color: colors.line,
          fontSize: 18,
          textAlign: "center",
          padding: 24,
        }}
      >
        {screenshot}
      </div>
      {caption ? (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: captionOpacity,
            transform: `translateY(${captionTranslate}px)`,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 48,
              fontWeight: 700,
              color: colors.ink,
              background: `${colors.panel}cc`,
              padding: "12px 32px",
              borderRadius: 12,
              border: `1px solid ${colors.lime}55`,
            }}
          >
            {caption}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
