import { AbsoluteFill, Sequence } from "remotion";
import { PAPER } from "./brandMark";
import { RevealBookend } from "./RevealBookend";
import { SneakPeekScene } from "./SneakPeekScene";
import { SNEAK_PEEK_BOOKEND_FRAMES, sneakPeekBeats } from "./sneakPeekBeats";

export function SneakPeekVideo() {
  let cursor = 0;
  const introFrom = cursor;
  cursor += SNEAK_PEEK_BOOKEND_FRAMES;

  const beatSequences = sneakPeekBeats.map((beat) => {
    const from = cursor;
    cursor += beat.durationInFrames;
    return { beat, from };
  });

  const outroFrom = cursor;

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Sequence from={introFrom} durationInFrames={SNEAK_PEEK_BOOKEND_FRAMES}>
        <RevealBookend mode="intro" />
      </Sequence>
      {beatSequences.map(({ beat, from }) => (
        <Sequence key={beat.id} from={from} durationInFrames={beat.durationInFrames}>
          <SneakPeekScene screenshot={beat.screenshot} caption={beat.caption} />
        </Sequence>
      ))}
      <Sequence from={outroFrom} durationInFrames={SNEAK_PEEK_BOOKEND_FRAMES}>
        <RevealBookend mode="outro" />
      </Sequence>
    </AbsoluteFill>
  );
}
