import { Composition } from "remotion";
import { InstagramReveal, INSTAGRAM_REVEAL_DURATION_IN_FRAMES } from "./InstagramReveal";
import { OchtDemo, TOTAL_DURATION_IN_FRAMES } from "./OchtDemo";
import { SneakPeekVideo } from "./SneakPeekVideo";
import { SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES } from "./sneakPeekBeats";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OchtDemo"
        component={OchtDemo}
        durationInFrames={TOTAL_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="InstagramReveal"
        component={InstagramReveal}
        durationInFrames={INSTAGRAM_REVEAL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="InstagramSneakPeekVertical"
        component={SneakPeekVideo}
        durationInFrames={SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="InstagramSneakPeekSquare"
        component={SneakPeekVideo}
        durationInFrames={SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};
