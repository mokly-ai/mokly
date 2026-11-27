import { useMemo } from "react";

import type { Publication } from "../../api/types";
import { useAddressPathname, useAddressSearch } from "../../navigation/address";
import { readQuery } from "../../navigation/query";
import { usePreviewScheme } from "../../theme/scheme";
import { readBuildAddressState } from "../../viewer/build-address";
import type { ViewerEntry } from "../../viewer/entry";
import type { ViewerScheme } from "../../viewer/host";
import { readViewerState } from "../../viewer/selection";
import type { SelectionDefaults, ViewerUrlState } from "../../viewer/selection";

/** The viewer's state, as the address and the resolved publication decide it. */
export interface ViewerAddressState {
  pathname: string;
  search: string;
  /** What the route's own query resolved to, and whether it needs correcting. */
  state: ViewerUrlState;
  corrected: boolean;
  defaults: SelectionDefaults;
  /** The open panel, which the settings dialog displaces while it is open. */
  panel: ViewerUrlState["panel"];
  /** Whether the address asks for the settings dialog, on any pane. */
  settingsRequested: boolean;
  /** Whether this publication has a comparison to list screens from. */
  comparable: boolean;
}

/**
 * Whether the address has a publication a panel could act on: unknown while it
 * resolves, a build address's own publication once its build has published,
 * and nothing for a reference that shows its build instead.
 */
function shareable(
  entry: ViewerEntry,
  publication: Publication | undefined,
  buildPublished: boolean | undefined,
): boolean | undefined {
  if (entry.kind === "loading" || entry.kind === "redirect") return undefined;
  if (entry.kind === "build") return entry.route ? buildPublished : false;
  return publication?.state === "ready";
}

/**
 * Read the viewer's state from the address it is at, validated against the
 * publication the route resolved. A build address carries no selection, so
 * only its panel and settings are read there.
 *
 * The viewer's own state is the query of that address, which the application
 * owns because the history stack it builds is its own. See
 * `src/navigation/address.ts`.
 */
export function useViewerAddressState(
  entry: ViewerEntry,
  publication: Publication | undefined,
  buildPublished?: boolean,
): ViewerAddressState {
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  // An address without `scheme` shows its previews in the system preference,
  // never in the Theme the reader chose for the application.
  const preferred: ViewerScheme = usePreviewScheme();
  const query = useMemo(() => readQuery(search), [search]);
  const settingsRequested = query.settings !== undefined;

  const comparable =
    publication?.state === "ready" &&
    publication.changes.state !== "no-comparison";

  // Three answers, not two: while the address is still being resolved nothing
  // is known about its publication, and a panel must not be corrected away on
  // the strength of an answer that has not arrived.
  const ready = shareable(entry, publication, buildPublished);
  const defaults = useMemo(
    () => ({
      scheme: preferred,
      publication: ready,
    }),
    [preferred, ready],
  );
  const buildRoute = entry.kind === "build" && entry.route;
  const { state, corrected } = useMemo(
    () =>
      buildRoute
        ? readBuildAddressState(query, defaults)
        : readViewerState(query, defaults),
    [query, defaults, buildRoute],
  );
  return {
    pathname,
    search,
    state,
    corrected,
    defaults,
    panel: settingsRequested ? undefined : state.panel,
    settingsRequested,
    comparable,
  };
}
