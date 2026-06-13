import { Composition } from "remotion";
import { OchtDemo, TOTAL_DURATION_IN_FRAMES } from "./OchtDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OchtDemo"
      component={OchtDemo}
      durationInFrames={TOTAL_DURATION_IN_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
