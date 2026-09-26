import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { useDarkPreview } from "./parts/appearance.js";
import { ComparisonStage } from "./parts/compare.js";
import { ComparisonStack } from "./parts/compare_stack.js";
import { DESTINATIONS, type DesignDestination } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { ReviewNav } from "./parts/review.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
} from "./parts/shell.js";
import { BrowserFrame, PhoneFrame } from "./parts/stage.js";

/** Welcome in Current, in Overlay, and in Overlay part-way down a long screen. */
type ChangesState = "current" | "overlay" | "overlay-long";

const DESIGNS: Record<ChangesState, DesignDestination> = {
  current: DESTINATIONS.current,
  overlay: DESTINATIONS.overlay,
  "overlay-long": DESTINATIONS.overlayLong,
};

function CurrentPreview({ viewport }: { viewport: ArtboardViewport }) {
  const dark = useDarkPreview();
  const content = <MiniWelcome compact={viewport === "mobile"} />;
  return viewport === "mobile" ? (
    <PhoneFrame dark={dark} small>
      {content}
    </PhoneFrame>
  ) : (
    <BrowserFrame address="example.test/welcome" dark={dark}>
      {content}
    </BrowserFrame>
  );
}

function OverlayPreview({
  long,
  viewport,
}: {
  long: boolean;
  viewport: ArtboardViewport;
}) {
  const compact = viewport === "mobile";
  return (
    <ComparisonStack
      address="example.test/welcome"
      after={<MiniWelcome compact={compact} inert long={long} revised />}
      before={<MiniWelcome compact={compact} inert long={long} />}
      dark={useDarkPreview()}
      mode="overlay"
      scrolled={long}
      viewport={viewport}
    />
  );
}

function ChangesScreen({
  state,
  viewport,
}: {
  state: ChangesState;
  viewport: ArtboardViewport;
}) {
  const comparing = state !== "current";
  return (
    <Shell
      design={DESIGNS[state]}
      viewport={viewport}
      nav={<ReviewNav activeTitle="Welcome" />}
    >
      <ScreenHead
        comparisons
        comparisonMode={comparing ? "overlay" : "current"}
        action={<ViewSwitch active={viewport} />}
        crumbs={["Example", "Screens"]}
        idChip="example-welcome"
        title="Welcome"
      />
      <PreviewWorkspace
        viewport={viewport}
        stage={!comparing}
        inspector={
          <DetailsPanel
            subject="welcome"
            comparisonEvidence={comparing || undefined}
            open={state === "overlay"}
          />
        }
        render={(previewViewport) =>
          comparing ? (
            <ComparisonStage state="changed" viewport={previewViewport}>
              <OverlayPreview
                long={state === "overlay-long"}
                viewport={previewViewport}
              />
            </ComparisonStage>
          ) : (
            <CurrentPreview viewport={previewViewport} />
          )
        }
      />
    </Shell>
  );
}

/** On-demand comparison controls share the normal catalogue screen. */
export const changesScreens = [
  screen({
    description:
      "Changes opens a screen in Current; comparison starts only after selecting a diff option, in either catalogue scheme.",
    desktop: <ChangesScreen state="current" viewport="desktop" />,
    id: "design-changes-current",
    mobile: <ChangesScreen state="current" viewport="mobile" />,
    slug: "current",
    title: "Current screen in Changes",
  }),
  screen({
    description:
      "Overlay compares the selected screen in place, with the same controls also available from All, in either catalogue scheme.",
    desktop: <ChangesScreen state="overlay" viewport="desktop" />,
    id: "design-changes-overlay",
    mobile: <ChangesScreen state="overlay" viewport="mobile" />,
    rationale:
      "Both versions share one frame, so the comparison reads as one screen: the current version sits over the previous one at half strength, and links inside it do nothing.",
    slug: "overlay",
    title: "On-demand overlay",
  }),
  screen({
    description:
      "Overlay on a screen longer than its frame scrolls both versions together, in either catalogue scheme.",
    desktop: <ChangesScreen state="overlay-long" viewport="desktop" />,
    id: "design-changes-overlay-long",
    mobile: <ChangesScreen state="overlay-long" viewport="mobile" />,
    rationale:
      "A long screen scrolls inside the one frame both versions share, so they always sit at the same position: unchanged sections line up exactly and only the reworded section shows both versions, wherever the reader stops.",
    slug: "overlay-long",
    title: "Overlay on a long screen",
  }),
];
