import type { ReactNode } from "react";

import { defineScreen } from "@mokly/mokly";

import { PreviewWorkspace } from "../../components/parts/workspace.js";
import { DesignAppearanceScope } from "../../parts/appearance.js";
import { artboards } from "../../parts/artboards.js";
import { DesignNavigation } from "../../parts/design_navigation.js";
import {
  DESTINATIONS,
  type DesignDestination,
} from "../../parts/destinations.js";
import { DetailsPanel } from "../../parts/details.js";
import { ENTRY_PATHS } from "../../parts/entry_paths.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { EmptyState, LoadingState } from "../../parts/stage_content.js";
import {
  AppearanceHead,
  AppearanceShell,
} from "../appearance/parts/scaffold.js";

const loadingDesignMetadata = {
  relatedDocs: [
    "docs/protocol/mokly-shell-delivery.md",
    "docs/protocol/mokly-shell-design.md",
  ],
};

/** The page before the catalogue index arrives: the shell has no chrome yet. */
function StartupPage({
  children,
  design,
  viewport,
}: {
  children: ReactNode;
  design: DesignDestination;
  viewport: ArtboardViewport;
}) {
  return (
    <DesignNavigation design={design}>
      <DesignAppearanceScope>
        <div className={`mbk-shell mbk-shell--${viewport}`}>{children}</div>
      </DesignAppearanceScope>
    </DesignNavigation>
  );
}

function CatalogueLoading({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StartupPage design={DESTINATIONS.catalogueLoading} viewport={viewport}>
      <LoadingState status="Loading catalogue…" />
    </StartupPage>
  );
}

function CatalogueFailed({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StartupPage design={DESTINATIONS.catalogueFailed} viewport={viewport}>
      <EmptyState
        title="The catalogue could not be loaded"
        linkLabel="Try again"
        to={DESTINATIONS.catalogueLoading}
      />
    </StartupPage>
  );
}

function ViewerVersion({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StartupPage design={DESTINATIONS.viewerVersion} viewport={viewport}>
      <EmptyState
        title="This catalogue needs a compatible viewer"
        linkLabel="Reload"
        to={DESTINATIONS.catalogueLoading}
      />
    </StartupPage>
  );
}

function PreviewLoading({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      design={DESTINATIONS.previewLoading}
      viewport={viewport}
    >
      <AppearanceHead
        highlight="loading"
        path={ENTRY_PATHS.welcome}
        preview={viewport}
        title="Welcome"
        viewport={viewport}
      />
      <PreviewWorkspace
        inspector={<DetailsPanel subject="welcome" />}
        viewport={viewport}
        render={() => <LoadingState status="Loading preview…" />}
      />
    </AppearanceShell>
  );
}

/** The client-rendered shell before its data arrives, and its recovery. */
export const catalogueLoadingScreen = defineScreen({
  ...loadingDesignMetadata,
  slug: "catalogue-loading",
  title: "Loading the catalogue",
  description:
    "One status line in the reader's appearance until the catalogue arrives.",
  rationale:
    "The shell has nothing to draw before the catalogue arrives, so the page shows one status line instead of empty chrome that would shift when the navigation appears.",
  ...artboards({
    desktop: <CatalogueLoading viewport="desktop" />,
    mobile: <CatalogueLoading viewport="mobile" />,
  }),
});
export const catalogueFailedScreen = defineScreen({
  ...loadingDesignMetadata,
  slug: "catalogue-failed",
  title: "Catalogue unavailable",
  description:
    "The catalogue could not be loaded, with one action that tries again.",
  ...artboards({
    desktop: <CatalogueFailed viewport="desktop" />,
    mobile: <CatalogueFailed viewport="mobile" />,
  }),
});
export const viewerVersionScreen = defineScreen({
  relatedDocs: [
    ...loadingDesignMetadata.relatedDocs,
    "docs/protocol/mokly-viewer-namespace.md",
  ],
  slug: "viewer-version",
  title: "Incompatible viewer",
  description:
    "The catalogue and the viewer come from different Mokly versions; in the standalone shell a reload loads the matching viewer.",
  rationale:
    "Every host shows the same headline. Serve and the static build ship their matching viewer, so the standalone shell offers Reload. An embedded viewer shows no action and reports the failure to its host through onError, with the version details, because only the host can update the viewer.",
  ...artboards({
    desktop: <ViewerVersion viewport="desktop" />,
    mobile: <ViewerVersion viewport="mobile" />,
  }),
});
export const previewLoadingScreen = defineScreen({
  ...loadingDesignMetadata,
  slug: "preview-loading",
  title: "Preview loading",
  description:
    "The selected screen's stage while its details load; the navigation and the details panel stay usable. The same stage covers a replaced catalogue: after another deployment answers, it keeps loading until the new catalogue arrives.",
  ...artboards({
    desktop: <PreviewLoading viewport="desktop" />,
    mobile: <PreviewLoading viewport="mobile" />,
  }),
});
