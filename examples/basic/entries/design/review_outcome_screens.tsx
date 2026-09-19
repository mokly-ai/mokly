import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { useDarkPreview } from "./parts/appearance.js";
import { CompareGrid, Pane } from "./parts/compare.js";
import {
  ComparePage,
  FramedShot,
  type CompareViewport,
} from "./parts/compare_page.js";
import { DESTINATIONS } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { ExampleWorkspace } from "./parts/example_workspace.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { ReviewNav } from "./parts/review.js";
import { ScreenHead, Shell, ViewSwitch } from "./parts/shell.js";
import { EmptyState } from "./parts/stage_content.js";

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

function RemovedCurrent({ viewport }: { viewport: CompareViewport }) {
  return (
    <Shell
      design={DESTINATIONS.removed}
      viewport={viewport}
      nav={viewport === "desktop" ? <ReviewNav activeTitle="Farewell" /> : null}
    >
      <ScreenHead
        action={<ViewSwitch active={viewport} />}
        crumbs={["Example", "Screens"]}
        idChip="example-farewell"
        status="removed"
        title="Farewell"
      />
      <PreviewWorkspace
        inspector={<DetailsPanel subject="farewell" comparisonEvidence open />}
        render={() => (
          <EmptyState
            body="There is no current preview to show."
            title="This screen was removed"
            to={DESTINATIONS.home}
          />
        )}
      />
    </Shell>
  );
}

function DifferenceCompare({ viewport }: { viewport: CompareViewport }) {
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
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} />
            </FramedShot>
          </Pane>
          <Pane label="Current" side="after">
            <FramedShot
              address="example.test/welcome"
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
    description: "A removed screen shown as an empty current state.",
    desktop: <RemovedCurrent viewport="desktop" />,
    id: "design-review-removed",
    mobile: <RemovedCurrent viewport="mobile" />,
    slug: "removed",
    title: "Removed screen",
  }),
  screen({
    colorSchemes: ["light"],
    description: "Difference mode blends the two screen versions in place.",
    desktop: <DifferenceCompare viewport="desktop" />,
    id: "design-review-difference",
    mobile: <DifferenceCompare viewport="mobile" />,
    slug: "difference",
    title: "Difference mode",
  }),
];
