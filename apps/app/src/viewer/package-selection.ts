import type { ViewerSelection as PackageSelection } from "@mokly/viewer";

import type { ViewerSelection } from "./host";

/**
 * Map the cloud route's names to the published package's controlled state:
 * `screen` becomes `screenPath` (absent becomes `null`), `scheme` becomes
 * `colorScheme`, an absent `snapshotId` stays omitted because the package
 * refuses a selection with a key it does not know, and every other field
 * passes unchanged.
 */
export function toPackageSelection(
  selection: ViewerSelection,
): PackageSelection {
  return {
    screenPath: selection.screen ?? null,
    ...(selection.snapshotId === undefined
      ? {}
      : { snapshotId: selection.snapshotId }),
    view: selection.view,
    viewport: selection.viewport,
    colorScheme: selection.scheme,
    search: selection.search,
    tags: selection.tags,
  };
}

/** Map a complete package proposal back without resetting any supported field. */
export function fromPackageSelection(
  selection: PackageSelection,
): ViewerSelection {
  return {
    ...(selection.screenPath === null ? {} : { screen: selection.screenPath }),
    ...(selection.snapshotId === undefined
      ? {}
      : { snapshotId: selection.snapshotId }),
    view: selection.view,
    viewport: selection.viewport,
    scheme: selection.colorScheme,
    search: selection.search,
    tags: selection.tags,
  };
}
