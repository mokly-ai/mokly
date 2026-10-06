import type { ColorScheme, Viewport } from "../data/axes.js";

import { snapshotViewPath, type SnapshotSide } from "./routes.js";

/** Name a review document from the requested side's recorded address. */
export function reviewSnapshotViewPath<
  Before extends string,
  After extends string,
>(
  side: SnapshotSide,
  record: { before?: { path: Before }; after?: { path: After } },
  view: { viewport: Viewport; colorScheme: ColorScheme },
): string {
  const address = record[side];
  if (!address)
    throw new Error(
      `[mokly/navigation/review_snapshot] missing ${side} address`,
    );
  return snapshotViewPath(side, address.path, view.viewport, view.colorScheme);
}
