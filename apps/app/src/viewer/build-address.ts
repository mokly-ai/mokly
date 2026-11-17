import type { Query } from "../navigation/address";
import { readViewerState } from "./selection";
import type { SelectionDefaults, ViewerUrlState } from "./selection";

/**
 * The keys of the viewer's selection. A build address names no publication,
 * so none of them applies there: only the panel and the settings pane do.
 */
const selectionKeys = [
  "view",
  "catalogueScreen",
  "catalogueSnapshot",
  "variantId",
  "viewport",
  "scheme",
  "search",
  "tag",
] as const;

/**
 * Read a build address. Its panel is validated as on every viewer route, and
 * any selection key it carries is a value this address cannot honour, so the
 * route corrects it away and keeps every key another surface owns.
 */
export function readBuildAddressState(
  query: Query,
  defaults: SelectionDefaults,
): { state: ViewerUrlState; corrected: boolean } {
  const { state, corrected } = readViewerState(
    query.panel === undefined ? {} : { panel: query.panel },
    defaults,
  );
  const carried = selectionKeys.some((key) => query[key] !== undefined);
  return { state, corrected: corrected || carried };
}
