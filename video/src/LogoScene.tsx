import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts } from "./theme";

type LogoSceneProps = {
  tagline?: string;
};

export function LogoScene({ tagline }: LogoSceneProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const shieldScale = interpolate(frame, [0, fps * 0.6], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shieldOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordmarkOpacity = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(
    frame,
    [fps * 0.9, fps * 1.4, durationInFrames - fps * 0.3, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: colors.panel,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <svg
        width={120}
        height={Math.round((120 * 78) / 64)}
        viewBox="0 0 64 78"
        fill="none"
        style={{
          transform: `scale(${shieldScale})`,
          opacity: shieldOpacity,
        }}
      >
        <path
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
          fill={colors.lime}
        />
        <text
          x="32"
          y="56"
          textAnchor="middle"
          fontFamily={fonts.display}
          fontWeight={900}
          fontSize={46}
          fill={colors.badgeInk}
        >
          8
        </text>
      </svg>
      <div
        style={{
          marginTop: 24,
          fontFamily: fonts.display,
          fontSize: 64,
          fontWeight: 700,
          color: colors.ink,
          opacity: wordmarkOpacity,
        }}
      >
        ocht<span style={{ color: colors.teal }}>.</span>
      </div>
      {tagline ? (
        <div
          style={{
            marginTop: 16,
            fontFamily: fonts.mono,
            fontSize: 28,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: colors.ink,
            opacity: taglineOpacity,
          }}
        >
          {tagline}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
