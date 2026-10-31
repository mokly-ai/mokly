import { defineScreen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { changesDesignMetadata } from "./metadata.js";
import { artboards } from "./parts/artboards.js";
import { DESTINATIONS } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { miniView } from "./parts/mini_views.js";
import { NavDrawer, NavTree } from "./parts/nav.js";
import { EmptyReviewNav, IGNORED_IMPACT, WelcomeShot } from "./parts/review.js";
import { WelcomeHead } from "./parts/screen_heads.js";
import { Shell } from "./parts/shell.js";

type ReviewViewport = "desktop" | "mobile";

function IgnoredOnlyCompare({ viewport }: { viewport: ReviewViewport }) {
  return (
    <Shell
      design={DESTINATIONS.ignored}
      viewport={viewport}
      nav={<NavTree activeLabel="Welcome" changedCount={0} />}
    >
      <PreviewWorkspace
        header={<WelcomeHead active={viewport} />}
        viewport={viewport}
        inspector={
          <DetailsPanel
            subject="welcome"
            comparisonEvidence={IGNORED_IMPACT}
            open
          />
        }
        view={miniView("welcome")}
        render={(previewViewport) => (
          <WelcomeShot viewport={previewViewport} comparison={false} />
        )}
      />
    </Shell>
  );
}

function EmptyChanges({ viewport }: { viewport: ReviewViewport }) {
  return (
    <Shell
      design={DESTINATIONS.empty}
      viewport={viewport}
      nav={<EmptyReviewNav />}
      aside={
        viewport === "mobile" ? (
          <NavDrawer changedOnly changedCount={0} nodes={[]} />
        ) : null
      }
    >
      <PreviewWorkspace
        header={<WelcomeHead active={viewport} changes />}
        viewport={viewport}
        inspector={<DetailsPanel subject="welcome" />}
        view={miniView("welcome")}
        render={(previewViewport) => (
          <WelcomeShot viewport={previewViewport} comparison={false} />
        )}
      />
    </Shell>
  );
}

/** Design screens for ignored comparison evidence and an empty Changes filter. */
export const ignoredOnlyScreen = defineScreen({
  ...changesDesignMetadata,
  colorSchemes: ["light"],
  description: "A screen whose only differences fall inside ignored regions.",
  ...artboards({
    desktop: <IgnoredOnlyCompare viewport="desktop" />,
    mobile: <IgnoredOnlyCompare viewport="mobile" />,
  }),
  slug: "ignored-only",
  title: "Ignored only",
});
export const emptyScreen = defineScreen({
  ...changesDesignMetadata,
  colorSchemes: ["light"],
  description:
    "Changes has no matching screens; the selected Current view remains available.",
  ...artboards({
    desktop: <EmptyChanges viewport="desktop" />,
    mobile: <EmptyChanges viewport="mobile" />,
  }),
  slug: "empty",
  title: "No changes",
});
