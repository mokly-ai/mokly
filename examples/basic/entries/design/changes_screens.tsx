import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { useDarkPreview } from "./parts/appearance.js";
import { ComparisonStage } from "./parts/compare.js";
import { DESTINATIONS } from "./parts/destinations.js";
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

function ChangesPreview({
  overlay,
  viewport,
}: {
  overlay: boolean;
  viewport: ArtboardViewport;
}) {
  const dark = useDarkPreview();
  const content = (
    <div style={{ position: "relative", isolation: "isolate" }}>
      <MiniWelcome compact={viewport === "mobile"} />
      {overlay ? (
        <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
          <MiniWelcome compact={viewport === "mobile"} revised />
        </div>
      ) : null}
    </div>
  );
  return viewport === "mobile" ? (
    <PhoneFrame dark={dark} small>
      {content}
    </PhoneFrame>
  ) : (
    <BrowserFrame
      address="example.test/welcome"
      dark={dark}
      expandable={!overlay}
    >
      {content}
    </BrowserFrame>
  );
}

function ChangesScreen({
  overlay,
  viewport,
}: {
  overlay: boolean;
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={overlay ? DESTINATIONS.overlay : DESTINATIONS.current}
      viewport={viewport}
      nav={<ReviewNav activeTitle="Welcome" />}
    >
      <ScreenHead
        comparisons
        comparisonMode={overlay ? "overlay" : "current"}
        action={<ViewSwitch active={viewport} />}
        crumbs={["Example", "Screens"]}
        idChip="example-welcome"
        title="Welcome"
      />
      <PreviewWorkspace
        viewport={viewport}
        stage={!overlay}
        inspector={
          <DetailsPanel
            subject="welcome"
            comparisonEvidence={overlay || undefined}
            open={overlay}
          />
        }
        render={(previewViewport) =>
          overlay ? (
            <ComparisonStage state="changed" viewport={previewViewport}>
              <ChangesPreview overlay viewport={previewViewport} />
            </ComparisonStage>
          ) : (
            <ChangesPreview overlay={false} viewport={previewViewport} />
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
    desktop: <ChangesScreen overlay={false} viewport="desktop" />,
    id: "design-changes-current",
    mobile: <ChangesScreen overlay={false} viewport="mobile" />,
    slug: "current",
    title: "Current screen in Changes",
  }),
  screen({
    description:
      "Overlay compares the selected screen in place, with the same controls also available from All, in either catalogue scheme.",
    desktop: <ChangesScreen overlay viewport="desktop" />,
    id: "design-changes-overlay",
    mobile: <ChangesScreen overlay viewport="mobile" />,
    slug: "overlay",
    title: "On-demand overlay",
  }),
];
