import type {
  NavigationFilter,
  NavigationStatus,
} from "@mokly/ui/catalogue-navigation";
import type {
  NavigationLeaf,
  NavigationSection,
} from "@mokly/ui/catalogue-tree";

import type { ViewerCatalogueScreen } from "../../../fixtures/viewer-catalogue";
import { viewerCatalogue } from "../../../fixtures/viewer-catalogue";

/** What the catalogue column lists: every screen, or only the changed ones. */
export type CatalogueView = "all" | "changes";

const changedCount = viewerCatalogue.screens.filter(
  ({ changed }) => changed,
).length;

/**
 * One screen's row. A drawing opens no catalogue screen, so the row has no
 * address, and the package draws it as a picture of the row. The Changes
 * filter hides a row whose screen did not change.
 */
function screenRow(
  screen: ViewerCatalogueScreen,
  view: CatalogueView,
): NavigationLeaf {
  return {
    kind: "leaf",
    link: {
      key: screen.path,
      entry: screen.path,
      kind: "screen",
      route: screen.path + "/index.html",
      label: screen.title,
      depth: 0,
      current: screen.path === viewerCatalogue.current,
      hidden: view === "changes" && !screen.changed,
      changed: screen.changed,
      changedVariants: false,
      index: false,
      removed: false,
      removedPage: false,
      removedVariant: false,
      tags: [],
    },
  };
}

/** The catalogue column's one open section and its screen rows. */
export function catalogueSections(
  view: CatalogueView,
): readonly NavigationSection[] {
  return [
    {
      id: "specs",
      label: viewerCatalogue.section,
      disclosure: "specs",
      open: true,
      hidden: false,
      rows: viewerCatalogue.screens.map((screen) => screenRow(screen, view)),
    },
  ];
}

/** The All and Changes filter, with the publication's changed screens. */
export function catalogueFilter(view: CatalogueView): NavigationFilter {
  return { status: "ready", view, count: changedCount };
}

/**
 * The status line under Changes. It stays hidden, because the filter keeps
 * the changed rows and Changes is ready.
 */
export const catalogueStatus: NavigationStatus = {
  message: "none",
  hidden: true,
};
