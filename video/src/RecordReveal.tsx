import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LIME, LIVE_PANEL, MUTED, RecordMark } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["900"] });
const mono = loadMonoFont("normal", { weights: ["500"] });

const BADGE_SIZE = 220;
const TAP_START = 108;
const TAP_END = 120;
const COUNT_3_END = 138;
const COUNT_2_END = 156;
const COUNT_1_END = 174;
const GO_END = 192;

const TAB_LABELS = ["New", "Progress", "Record", "Compare", "Records"];

// Ports styles/_layout.scss's `tab-bar-record-pulse` keyframe (scale 1 -> 1.55,
// opacity 0.7 -> 0, 2.2s ease-out, infinite, two rings staggered 0.7s) into
// frame-based interpolation, since Remotion renders frame-by-frame rather
// than running live CSS animation. Easing.out(Easing.quad) approximates the
// CSS `ease-out` timing function closely enough for this decorative motion.
function pulseRing(frame: number, delayFrames: number, periodFrames: number) {
  const local = frame - delayFrames;
  if (local < 0) {
    return { scale: 1, opacity: 0 };
  }
  const t = (local % periodFrames) / periodFrames;
  const eased = Easing.out(Easing.quad)(t);
  return { scale: 1 + eased * 0.55, opacity: 0.7 * (1 - eased) };
}

function CountdownLabel({
  text,
  color,
  fontSize,
  fontFamily,
  localFrame,
  segmentFrames,
}: {
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  localFrame: number;
  segmentFrames: number;
}) {
  const scale = interpolate(localFrame, [0, segmentFrames * 0.4], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.7)),
  });
  const opacity = interpolate(localFrame, [0, segmentFrames * 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <p
      style={{
        margin: 0,
        fontFamily,
        fontWeight: 500,
        fontSize,
        color,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {text}
    </p>
  );
}

export function RecordReveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ringPeriodFrames = Math.round(2.2 * fps);
  const ringStaggerFrames = Math.round(0.7 * fps);

  const introOpacity = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headlineOpacity = interpolate(frame, [36, 54, 96, 108], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneVisible = frame < TAP_END;
  // The real RecordBadge/tab-bar__record has no :active press state today —
  // tapping it just navigates. This scale-down/up + white tap-dot flourish
  // is a deliberate addition for THIS VIDEO ONLY, purely so a static tap
  // reads as "pressed" on video; it does not reflect real app behavior. See
  // the "Deliberate non-parity" section of the design spec.
  const tapVisible = frame >= TAP_START && frame < TAP_END;
  const tapProgress = tapVisible ? (frame - TAP_START) / (TAP_END - TAP_START) : 0;
  const tapDotScale = interpolate(tapProgress, [0, 0.5, 1], [1.4, 1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tapDotOpacity = interpolate(tapProgress, [0, 0.2, 1], [0, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeScale = interpolate(
    frame,
    [TAP_START, TAP_START + 4, TAP_START + 8, TAP_END],
    [1, 0.85, 1.05, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const countdownVisible = frame >= TAP_END && frame < GO_END;

  const ring1 = pulseRing(frame, 0, ringPeriodFrames);
  const ring2 = pulseRing(frame, ringStaggerFrames, ringPeriodFrames);

  const endCardOpacity = interpolate(frame, [GO_END, GO_END + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: LIVE_PANEL }}>
      {sceneVisible ? (
        <AbsoluteFill style={{ opacity: introOpacity }}>
          <div
            style={{
              position: "absolute",
              top: 700,
              left: "50%",
              transform: "translateX(-50%)",
              width: BADGE_SIZE + 120,
              height: BADGE_SIZE + 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                borderRadius: "50%",
                border: "1px solid rgba(200, 255, 46, 0.4)",
                transform: `scale(${ring1.scale})`,
                opacity: ring1.opacity,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                borderRadius: "50%",
                border: "1px solid rgba(200, 255, 46, 0.4)",
                transform: `scale(${ring2.scale})`,
                opacity: ring2.opacity,
              }}
            />
            <div style={{ transform: `scale(${badgeScale})` }}>
              <RecordMark size={BADGE_SIZE} displayFontFamily={display.fontFamily} />
            </div>
            {tapVisible ? (
              <div
                style={{
                  position: "absolute",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#ffffff",
                  transform: `scale(${tapDotScale})`,
                  opacity: tapDotOpacity,
                }}
              />
            ) : null}
          </div>

          <p
            style={{
              position: "absolute",
              top: 560,
              left: 0,
              right: 0,
              textAlign: "center",
              margin: 0,
              fontFamily: display.fontFamily,
              fontWeight: 900,
              fontSize: 52,
              color: LIME,
              opacity: headlineOpacity,
            }}
          >
            Record. Now live.
          </p>

          <div
            style={{
              position: "absolute",
              bottom: 140,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 28,
            }}
          >
            {TAB_LABELS.map((label) => (
              <span
                key={label}
                style={{
                  fontFamily: mono.fontFamily,
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: label === "Record" ? LIME : MUTED,
                  opacity: label === "Record" ? 0.9 : 0.35,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </AbsoluteFill>
      ) : null}

      {countdownVisible ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          {frame < COUNT_3_END ? (
            <CountdownLabel
              text="3"
              color="#f4f7ef"
              fontSize={220}
              fontFamily={mono.fontFamily}
              localFrame={frame - TAP_END}
              segmentFrames={COUNT_3_END - TAP_END}
            />
          ) : null}
          {frame >= COUNT_3_END && frame < COUNT_2_END ? (
            <CountdownLabel
              text="2"
              color="#f4f7ef"
              fontSize={220}
              fontFamily={mono.fontFamily}
              localFrame={frame - COUNT_3_END}
              segmentFrames={COUNT_2_END - COUNT_3_END}
            />
          ) : null}
          {frame >= COUNT_2_END && frame < COUNT_1_END ? (
            <CountdownLabel
              text="1"
              color="#f4f7ef"
              fontSize={220}
              fontFamily={mono.fontFamily}
              localFrame={frame - COUNT_2_END}
              segmentFrames={COUNT_1_END - COUNT_2_END}
            />
          ) : null}
          {frame >= COUNT_1_END && frame < GO_END ? (
            <CountdownLabel
              text="GO"
              color={LIME}
              fontSize={260}
              fontFamily={display.fontFamily}
              localFrame={frame - COUNT_1_END}
              segmentFrames={GO_END - COUNT_1_END}
            />
          ) : null}
        </AbsoluteFill>
      ) : null}

      {frame >= GO_END ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            opacity: endCardOpacity,
          }}
        >
          <RecordMark size={150} displayFontFamily={display.fontFamily} />
          <p
            style={{
              marginTop: 32,
              fontFamily: display.fontFamily,
              fontWeight: 900,
              fontSize: 40,
              letterSpacing: "0.04em",
              textAlign: "center",
              color: "#f4f7ef",
            }}
          >
            TAP TO LAP.
            <br />
            NOW LIVE.
          </p>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

export const RECORD_REVEAL_DURATION_IN_FRAMES = 240;
