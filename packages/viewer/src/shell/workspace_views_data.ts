// The changed views of a workspace, keyed by the selection that shows them.
// A published catalogue supplies them from its ready per-view comparisons;
// unknown evidence stays an empty list, so the workspace never claims a view
// is unmodified when it has not examined one.

import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
import type { ManifestScreen } from "../registry/types.js";

import type { ChangedView } from "./view_marks.js";

/** Changed views keyed by saved-variant id for components and entry id for screens. */
export type ChangedViewsBySelection = Readonly<
  Record<string, readonly ChangedView[]>
>;

/** Read the screen or selected saved variant without a caller inventing a key. */
export function selectedChangedViews(
  entry: ManifestComponent | ManifestComponentVariant | ManifestScreen,
  evidence: ChangedViewsBySelection,
  variantPath?: string,
): readonly ChangedView[] {
  const key = entry.kind === "screen" ? entry.path : variantPath;
  return key && Object.hasOwn(evidence, key) ? (evidence[key] ?? []) : [];
}
