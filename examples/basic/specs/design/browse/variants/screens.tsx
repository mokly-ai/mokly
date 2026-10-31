import { MockLink, defineScreen } from "@mokly/mokly";

import { designMetadata } from "../../metadata.js";
import { artboards } from "../../parts/artboards.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { ENTRY_PATHS, EXAMPLE_CRUMB } from "../../parts/entry_paths.js";
import { ExampleWorkspace } from "../../parts/example_workspace.js";
import { NavTree } from "../../parts/nav.js";
import { NAV_TREE_VARIANTS_OPEN } from "../../parts/nav_data.js";
import { reasonEvidence } from "../../parts/reason_sentences.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
  type ChangedView,
  type Crumb,
} from "../../parts/shell.js";
import {
  CHANGED_VARIANT_ROWS,
  CHANGED_VIEW_ROWS,
} from "../../parts/variant_nav_data.js";

/** Only Welcome's dark renders changed, in both viewports. */
const DARK_VIEWS: readonly ChangedView[] = [
  { viewport: "mobile", scheme: "dark" },
  { viewport: "desktop", scheme: "dark" },
];

/**
 * A variant keeps its parent's breadcrumbs and ends in the parent's title.
 * These Changes and removed states keep every crumb as text.
 */
export const VARIANT_CRUMBS: readonly Crumb[] = [
  "Example",
  "Screens",
  "Welcome",
];

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
      <ExampleWorkspace
        empty
        header={
          <ScreenHead
            action={
              <ViewSwitch active={viewport === "mobile" ? "mobile" : "both"} />
            }
            crumbs={[
              EXAMPLE_CRUMB,
              "Screens",
              { label: "Welcome", to: DESTINATIONS.welcome },
            ]}
            path={ENTRY_PATHS.welcomeEmpty}
            title="Empty workspace"
          />
        }
        subject="welcome"
        viewport={viewport}
      />
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
      <ExampleWorkspace
        comparisonEvidence={{ reasons: reasonEvidence(["material"]) }}
        error
        header={
          <ScreenHead
            comparisons
            action={<ViewSwitch active={viewport} />}
            comparisonMode="current"
            crumbs={VARIANT_CRUMBS}
            path={ENTRY_PATHS.welcomeError}
            status="changed"
            title="Save failed"
          />
        }
        subject="welcome"
        viewport={viewport}
      />
    </Shell>
  );
}

function ChangedViews({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.changedViews}
      changedViews={DARK_VIEWS}
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
      <ExampleWorkspace
        header={
          <ScreenHead
            action={<ViewSwitch active={viewport} changedViews={DARK_VIEWS} />}
            crumbs={["Example", "Screens"]}
            path={ENTRY_PATHS.welcome}
            status="unmodified"
            title="Welcome"
          />
        }
        changedViews={
          <MockLink to={DESTINATIONS.changed}>
            Mobile · Dark, Desktop · Dark
          </MockLink>
        }
        comparisonEvidence={{ reasons: reasonEvidence(["material"]) }}
        open
        subject="welcome"
        viewport={viewport}
      />
    </Shell>
  );
}

/** Browse states for a screen's variants and for per-view change evidence. */
export const variantSelectedScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A selected variant beside its parent screen, with the parent's variant list disclosed in the navigation.",
  ...artboards({
    desktop: <SelectedVariant viewport="desktop" />,
    mobile: <SelectedVariant viewport="mobile" />,
  }),
  slug: "variant-selected",
  rationale:
    "The parent row stays the link to the parent screen and carries a separate 16px chevron disclosure, because a row cannot be both a link and a disclosure summary. Variant rows sit one indent step deeper with the same guide painting and their own icon, a screen drawn over a second screen behind it, so a variant reads as a state of the screen above it rather than another screen. The breadcrumb ends in the parent's title as a link, and the variant supplies only its own title, description, and render. The navigation fixture is static here; no screen in this group uses an authored variant list yet.",
  title: "Selected variant",
});
export const variantChangesScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "The Changes filter showing one changed variant under a parent whose own render is unmodified.",
  ...artboards({
    desktop: <ChangedVariant viewport="desktop" />,
    mobile: <ChangedVariant viewport="mobile" />,
  }),
  slug: "variant-changes",
  rationale:
    "A variant is its own routed entry, so the count is one and the changed row is the variant, not the parent. The parent stays visible through its trailing changed dot and opens the first changed variant when activated, which keeps the group readable without claiming the parent itself changed. The comparison band opens in Current; the remaining modes are depictions until a matching comparison state is authored.",
  title: "Changed variant",
});
export const changedViewsScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A screen opened from Changes whose change is confined to its dark views, with the shown view unmodified.",
  ...artboards({
    desktop: <ChangedViews viewport="desktop" />,
    mobile: <ChangedViews viewport="mobile" />,
  }),
  slug: "changed-views",
  rationale:
    "Color scheme and viewport stay view axes rather than variants, so a change confined to one view is evidence on the view controls: a mark on top-bar Appearance and on the viewport dropdown points at the views that changed, the status beside the title describes the shown view, and the details list names them exactly. Appearance selects the scheme; the navigation and Details retain the links to the changed screen.",
  title: "Changed views",
});
