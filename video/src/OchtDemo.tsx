import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { LogoScene } from "./LogoScene";
import { Scene } from "./Scene";
import { colors } from "./theme";

const TRANSITION_FRAMES = 12;

type SceneDefinition = {
  element: JSX.Element;
  durationInFrames: number;
};

const scenes: SceneDefinition[] = [
  { element: <LogoScene />, durationInFrames: 120 },
  {
    element: (
      <Scene
        screenshot="screenshots/02-hero.png"
        caption="Race split analysis for hybrid athletes"
      />
    ),
    durationInFrames: 210,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/03-format-picker.png"
        caption="Pick your race format"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/04-split-form.png"
        caption="Enter your run & station splits"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/05-generating.png"
        caption="Instant analysis"
      />
    ),
    durationInFrames: 120,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/06-results-reveal.png"
        caption="Get your results instantly"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/07-race-flow.png"
        caption="See your race flow, archetype & roxzone tax"
      />
    ),
    durationInFrames: 300,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/08-leaks.png"
        caption="Find your biggest time leaks"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/09-training.png"
        caption="Get a 4-week training focus"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/10-simulator.png"
        caption="Simulate a faster finish"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/11-progress.png"
        caption="Track progress across races"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/12-premium.png"
        caption="Unlock the full report with Ocht Premium"
      />
    ),
    durationInFrames: 180,
  },
  {
    element: <LogoScene tagline="Train smarter, race faster" />,
    durationInFrames: 150,
  },
];

export const TOTAL_DURATION_IN_FRAMES =
  scenes.reduce((total, scene) => total + scene.durationInFrames, 0) -
  TRANSITION_FRAMES * (scenes.length - 1);

export function OchtDemo() {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.panel }}>
      <TransitionSeries>
        {scenes.flatMap((scene, index) => {
          const items = [
            <TransitionSeries.Sequence
              key={`scene-${index}`}
              durationInFrames={scene.durationInFrames}
            >
              {scene.element}
            </TransitionSeries.Sequence>,
          ];

          if (index < scenes.length - 1) {
            items.push(
              <TransitionSeries.Transition
                key={`transition-${index}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          }

          return items;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
