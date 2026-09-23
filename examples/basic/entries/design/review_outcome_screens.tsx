import { screen } from "@mokly/mokly";

import { useDarkPreview } from "./parts/appearance.js";
import { CompareGrid, Pane } from "./parts/compare.js";
import {
  ComparePage,
  FramedShot,
  type CompareViewport,
} from "./parts/compare_page.js";
import { DESTINATIONS } from "./parts/destinations.js";
import { ExampleWorkspace } from "./parts/example_workspace.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { REMOVED_SCREENS } from "./parts/nav_data.js";
import { RemovedScreen, RemovedView } from "./parts/removed_screen.js";
import { MiniFarewell } from "./parts/removed_shots.js";
import { ReviewNav } from "./parts/review.js";
import { ScreenHead, Shell, ViewSwitch } from "./parts/shell.js";

function ChangedCompare({ viewport }: { viewport: CompareViewport }) {
  const dark = useDarkPreview();
  return (
    <ComparePage
      design={DESTINATIONS.changed}
      activeTitle="Welcome"
      subject="welcome"
      idChip="example-welcome"
      state="changed"
      title="Welcome"
      viewport={viewport}
      render={(previewViewport) => (
        <CompareGrid>
          <Pane label="Before" side="before">
            <FramedShot
              address="example.test/welcome"
              dark={dark}
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} />
            </FramedShot>
          </Pane>
          <Pane label="Current" side="after">
            <FramedShot
              address="example.test/welcome"
              dark={dark}
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} revised />
            </FramedShot>
          </Pane>
        </CompareGrid>
      )}
    />
  );
}

function AddedCurrent({ viewport }: { viewport: CompareViewport }) {
  return (
    <Shell
      design={DESTINATIONS.added}
      viewport={viewport}
      nav={viewport === "desktop" ? <ReviewNav activeTitle="Details" /> : null}
    >
      <ScreenHead
        action={<ViewSwitch active={viewport} />}
        crumbs={["Example", "Screens"]}
        idChip="example-details"
        status="added"
        title="Details"
      />
      <ExampleWorkspace
        subject="details"
        viewport={viewport}
        comparisonEvidence={<p>Added to this branch.</p>}
      />
    </Shell>
  );
}

function RemovedPrevious({ viewport }: { viewport: CompareViewport }) {
  return (
    <RemovedScreen
      entry={REMOVED_SCREENS.farewell}
      preview={(previewViewport) => (
        <RemovedView
          address="example.test/farewell"
          compact={viewport === "mobile"}
          viewport={previewViewport}
        >
          <MiniFarewell compact={previewViewport === "mobile"} />
        </RemovedView>
      )}
      subject="farewell"
      viewport={viewport}
    />
  );
}

function DifferenceCompare({ viewport }: { viewport: CompareViewport }) {
  const dark = useDarkPreview();
  return (
    <ComparePage
      design={DESTINATIONS.difference}
      activeTitle="Welcome"
      subject="welcome"
      idChip="example-welcome"
      mode="difference"
      state="changed"
      title="Welcome"
      viewport={viewport}
      render={(previewViewport) => (
        <CompareGrid difference>
          <Pane label="Before" side="before">
            <FramedShot
              address="example.test/welcome"
              dark={dark}
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} />
            </FramedShot>
          </Pane>
          <Pane label="Current" side="after">
            <FramedShot
              address="example.test/welcome"
              dark={dark}
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} revised />
            </FramedShot>
          </Pane>
        </CompareGrid>
      )}
    />
  );
}

/** Review design screens for per-screen comparison outcomes. */
export const reviewOutcomeScreens = [
  screen({
    description:
      "A changed screen compared side by side with its base render, in either catalogue scheme.",
    desktop: <ChangedCompare viewport="desktop" />,
    id: "design-review-changed",
    mobile: <ChangedCompare viewport="mobile" />,
    slug: "changed",
    title: "Changed screen",
  }),
  screen({
    colorSchemes: ["light"],
    description: "An added screen shown directly in its current state.",
    desktop: <AddedCurrent viewport="desktop" />,
    id: "design-review-added",
    mobile: <AddedCurrent viewport="mobile" />,
    slug: "added",
    title: "Added screen",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A removed screen shown as the previous version of its mobile and desktop views.",
    desktop: <RemovedPrevious viewport="desktop" />,
    id: "design-review-removed",
    mobile: <RemovedPrevious viewport="mobile" />,
    rationale:
      "A removed screen has nothing current to compare, so the stage carries its previous views under a quiet label instead of a comparison band. The catalogue-wide Appearance selector remains the only theme control, while the historical frame stays Light because that is the only scheme captured for those views.",
    slug: "removed",
    title: "Removed screen",
  }),
  screen({
    description:
      "Difference mode blends the two screen versions in place, in either catalogue scheme.",
    desktop: <DifferenceCompare viewport="desktop" />,
    id: "design-review-difference",
    mobile: <DifferenceCompare viewport="mobile" />,
    slug: "difference",
    title: "Difference mode",
  }),
];
