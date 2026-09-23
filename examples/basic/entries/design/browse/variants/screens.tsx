import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "../../components/parts/workspace.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { DetailsPanel } from "../../parts/details.js";
import { ExampleWorkspace } from "../../parts/example_workspace.js";
import { NavTree } from "../../parts/nav.js";
import {
  CHANGED_VARIANT_ROWS,
  CHANGED_VIEW_ROWS,
  NAV_TREE_VARIANTS_OPEN,
  REPARENTED_REMOVED_VARIANT_ROWS,
  REMOVED_VARIANT_ROWS,
} from "../../parts/nav_data.js";
import { PreviousVersionLabel } from "../../parts/removed_preview.js";
import { RemovedView } from "../../parts/removed_screen.js";
import { MiniSaveFailed } from "../../parts/removed_shots.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
  type ChangedView,
  type Crumb,
} from "../../parts/shell.js";

/** Only Welcome's dark renders changed, in both viewports. */
const DARK_VIEWS: readonly ChangedView[] = [
  { viewport: "mobile", scheme: "dark" },
  { viewport: "desktop", scheme: "dark" },
];

/** A variant keeps its parent's breadcrumbs and ends in the parent's title. */
const VARIANT_CRUMBS: readonly Crumb[] = ["Example", "Screens", "Welcome"];

function SelectedVariant({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.variantSelected}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeDestination={DESTINATIONS.variantSelected}
            nodes={NAV_TREE_VARIANTS_OPEN}
          />
        ) : null
      }
    >
      <ScreenHead
        action={
          <ViewSwitch active={viewport === "mobile" ? "mobile" : "both"} />
        }
        crumbs={[
          "Example",
          "Screens",
          { label: "Welcome", to: DESTINATIONS.welcome },
        ]}
        idChip="example-welcome-empty"
        title="Empty workspace"
      />
      <ExampleWorkspace empty subject="welcome" viewport={viewport} />
    </Shell>
  );
}

function ChangedVariant({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.variantChanges}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeLabel="Save failed"
            changedCount={1}
            changedOnly
            nodes={CHANGED_VARIANT_ROWS}
          />
        ) : null
      }
    >
      <ScreenHead
        comparisons
        action={<ViewSwitch active={viewport} />}
        comparisonMode="current"
        crumbs={VARIANT_CRUMBS}
        idChip="example-welcome-error"
        status="changed"
        title="Save failed"
      />
      <ExampleWorkspace error subject="welcome" viewport={viewport} />
    </Shell>
  );
}

function RemovedVariant({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.variantRemoved}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeLabel="Save failed · Removed"
            changedCount={1}
            changedOnly
            nodes={REMOVED_VARIANT_ROWS}
          />
        ) : null
      }
    >
      <ScreenHead
        action={<ViewSwitch active={viewport} />}
        crumbs={VARIANT_CRUMBS}
        idChip="example-welcome-error"
        status="removed"
        title="Save failed"
      />
      <PreviousVersionLabel />
      <PreviewWorkspace
        viewport={viewport}
        inspector={
          <DetailsPanel comparisonEvidence open subject="welcomeError" />
        }
        render={(previewViewport) => (
          <RemovedView
            address="example.test/welcome"
            compact={viewport === "mobile"}
            viewport={previewViewport}
          >
            <MiniSaveFailed compact={previewViewport === "mobile"} />
          </RemovedView>
        )}
      />
    </Shell>
  );
}

function ReparentedRemovedVariant({
  viewport,
}: {
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={DESTINATIONS.variantReparented}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeLabel="Save failed · Removed"
            changedCount={1}
            changedOnly
            nodes={REPARENTED_REMOVED_VARIANT_ROWS}
          />
        ) : null
      }
    >
      <ScreenHead
        action={<ViewSwitch active={viewport} />}
        crumbs={VARIANT_CRUMBS}
        idChip="example-welcome-error"
        status="removed"
        title="Save failed"
      />
      <PreviousVersionLabel />
      <PreviewWorkspace
        viewport={viewport}
        inspector={
          <DetailsPanel
            comparisonEvidence
            open
            subject="welcomeErrorReparented"
          />
        }
        render={(previewViewport) => (
          <RemovedView
            address="example.test/welcome"
            compact={viewport === "mobile"}
            viewport={previewViewport}
          >
            <MiniSaveFailed compact={previewViewport === "mobile"} />
          </RemovedView>
        )}
      />
    </Shell>
  );
}

function ChangedViews({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.changedViews}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeDestination={DESTINATIONS.changedViews}
            changedCount={1}
            changedOnly
            nodes={CHANGED_VIEW_ROWS}
          />
        ) : null
      }
    >
      <ScreenHead
        action={<ViewSwitch active={viewport} changedViews={DARK_VIEWS} />}
        crumbs={["Example", "Screens"]}
        idChip="example-welcome"
        status="unmodified"
        title="Welcome"
      />
      <ExampleWorkspace
        changedViews="Mobile · Dark, Desktop · Dark"
        open
        subject="welcome"
        viewport={viewport}
      />
    </Shell>
  );
}

/** Browse states for a screen's variants and for per-view change evidence. */
export const variantScreens = [
  screen({
    colorSchemes: ["light"],
    description:
      "A selected variant beside its parent screen, with the parent's variant list disclosed in the navigation.",
    desktop: <SelectedVariant viewport="desktop" />,
    id: "design-browse-variant-selected",
    mobile: <SelectedVariant viewport="mobile" />,
    rationale:
      "The parent row stays the link to the parent screen and carries a separate 16px chevron disclosure, because a row cannot be both a link and a disclosure summary. Variant rows sit one indent step deeper with the same guide painting and their own icon, a screen drawn over a second screen behind it, so a variant reads as a state of the screen above it rather than another screen. The breadcrumb ends in the parent's title as a link, and the variant supplies only its own title, description, and render. The navigation fixture is static here; no screen in this group uses an authored variant list yet.",
    slug: "selected",
    title: "Selected variant",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "The Changes filter showing one changed variant under a parent whose own render is unmodified.",
    desktop: <ChangedVariant viewport="desktop" />,
    id: "design-browse-variant-changes",
    mobile: <ChangedVariant viewport="mobile" />,
    rationale:
      "A variant is its own routed entry, so the count is one and the changed row is the variant, not the parent. The parent stays visible through its trailing changed dot and opens the first changed variant when activated, which keeps the group readable without claiming the parent itself changed. The comparison band opens in Current; the remaining modes are depictions until a matching comparison state is authored.",
    slug: "changes",
    title: "Changed variant",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A deleted variant retained as a Removed row under its surviving parent.",
    desktop: <RemovedVariant viewport="desktop" />,
    id: "design-browse-variant-removed",
    mobile: <RemovedVariant viewport="mobile" />,
    rationale:
      "A removed variant follows the removed-screen rules: it is hidden from All, shown in Changes under the parent it belonged to, and has no current preview. Its recorded details stay available so a reviewer can see what was deleted, and All returns to the parent rather than to catalogue home because the parent still exists.",
    slug: "removed",
    title: "Removed variant",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A removed variant kept as a flat Changes row because its former parent is now another screen's variant.",
    desktop: <ReparentedRemovedVariant viewport="desktop" />,
    id: "design-browse-variant-reparented",
    mobile: <ReparentedRemovedVariant viewport="mobile" />,
    rationale:
      "A current variant cannot own its own variant list. When the former parent id is reused as a variant, only the historical child changes: Changes hides the unmodified parent and its variant and shows the child once as a flat Removed row.",
    slug: "reparented",
    title: "Removed variant after reparenting",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A screen opened from Changes whose change is confined to its dark views, with the shown view unmodified.",
    desktop: <ChangedViews viewport="desktop" />,
    id: "design-browse-changed-views",
    mobile: <ChangedViews viewport="mobile" />,
    rationale:
      "Color scheme and viewport stay view axes rather than variants, so a change confined to one view is evidence on the view controls: a mark on the theme control and on the viewport dropdown points at the views that changed, the status beside the title describes the shown view, and the details list names them exactly. The theme control opens the dark comparison so the reviewer can reach the change in one step.",
    slug: "changed-views",
    title: "Changed views",
  }),
];
