/** Pure adoption of a new index and its details into the shell's state. */

import {
  detailKey,
  fenceDetail,
  type DetailRequest,
} from "../catalogue/detail_fences.js";
import type { HeldDetails } from "../catalogue/shell_model.js";
import { shellCatalogueModel } from "../catalogue/shell_model.js";
import type { CatalogueReadModel, EntryDetailV1 } from "../catalogue/types.js";
import { viewerCatalogue } from "../viewer/projection.js";

import type { Catalogue } from "./catalogue.js";
import { reconcileDisclosures } from "./disclosure_storage.js";
import {
  catalogueNavSections,
  defaultDisclosures,
  navigationFiltering,
} from "./nav_model.js";
import { routeFromUrl, type ShellRoute } from "./routes.js";
import type { ShellState } from "./store_state.js";
import { toRouteTarget } from "./target.js";

/** The installed index, the details it accepted, and their shell model. */
export interface ShellDataSnapshot {
  index: CatalogueReadModel;
  details: HeldDetails;
  catalogue: Catalogue;
}

/** Build the working catalogue of one index and its accepted details. */
export function dataSnapshot(
  index: CatalogueReadModel,
  details: HeldDetails,
): ShellDataSnapshot {
  return {
    index,
    details,
    catalogue: viewerCatalogue(shellCatalogueModel(index, details)),
  };
}

/** The first snapshot: an index and the given details its fences accept. */
export function initialSnapshot(
  index: CatalogueReadModel,
  details: readonly (readonly [DetailRequest, EntryDetailV1])[] = [],
): ShellDataSnapshot {
  const held = new Map<string, EntryDetailV1>();
  for (const [request, detail] of details)
    if (fenceDetail(index, request, detail).kind === "accepted")
      held.set(detailKey(request), detail);
  return dataSnapshot(index, held);
}

/** Add accepted details to an unchanged index. */
export function withDetails(
  snapshot: ShellDataSnapshot,
  accepted: readonly (readonly [DetailRequest, EntryDetailV1])[],
): ShellDataSnapshot {
  const details = new Map(snapshot.details);
  for (const [request, detail] of accepted)
    details.set(detailKey(request), detail);
  return dataSnapshot(snapshot.index, details);
}

/**
 * Adopt a newer index with the details accepted against it. Held details of
 * an older revision are dropped, so navigation fetches them again; removed
 * entries' details stay while their generation stays the same.
 */
export function withIndex(
  snapshot: ShellDataSnapshot,
  index: CatalogueReadModel,
  accepted: readonly (readonly [DetailRequest, EntryDetailV1])[],
): ShellDataSnapshot {
  const details = new Map<string, EntryDetailV1>();
  for (const [key, detail] of snapshot.details)
    if (
      detail.revision === undefined
        ? snapshot.index.comparisonUrl === index.comparisonUrl
        : detail.revision === index.revision &&
          detail.deploymentId === index.deploymentId
    )
      details.set(key, detail);
  for (const [request, detail] of accepted)
    details.set(detailKey(request), detail);
  return dataSnapshot(index, details);
}

/**
 * Rebind the routed record and reconcile the disclosures after the catalogue
 * changed in place. A routed entry the catalogue no longer lists becomes the
 * missing state and keeps its URL, and a missing route shows its entry again
 * once the catalogue lists it; surviving disclosure choices stay.
 */
export function shellStateWithCatalogue(
  state: ShellState,
  catalogue: Catalogue,
): ShellState {
  const route = reboundRoute(state.route, catalogue);
  const sections = catalogueNavSections(catalogue);
  const activeId =
    route.view.kind === "target" ? route.view.target.entry.path : undefined;
  const defaults = defaultDisclosures(sections, activeId);
  const disclosures = reconcileDisclosures(
    defaults,
    state.disclosures,
    navigationFiltering(state.selection) ? "open" : "default",
  );
  const filterBaseline = state.filterBaseline
    ? reconcileDisclosures(defaults, state.filterBaseline, "default")
    : undefined;
  const status = catalogue.publicModel?.changesStatus;
  return {
    ...state,
    route,
    disclosures,
    filterBaseline,
    changesStatus: status && status !== "disabled" ? status : undefined,
  };
}

function reboundRoute(route: ShellRoute, catalogue: Catalogue): ShellRoute {
  if (route.view.kind === "missing") {
    // The kept URL resolves again under the page-load rules.
    const url = new URL(
      `/${route.view.requested}`,
      "https://catalogue.invalid",
    );
    if (route.snapshot) url.searchParams.set("snapshot", route.snapshot);
    const resolved = routeFromUrl(catalogue, url);
    return resolved.view.kind === "target"
      ? { ...route, view: resolved.view }
      : route;
  }
  if (route.view.kind !== "target") return route;
  const previous = route.view.target.entry;
  const entry = route.snapshot
    ? catalogue.removedEntries.find(
        (record) =>
          record.entry.path === previous.path &&
          record.entry.kind === previous.kind &&
          record.snapshotId === route.snapshot,
      )?.entry
    : catalogue.byPath.get(previous.path);
  const target = entry && toRouteTarget(entry);
  return target && entry.path === previous.path && entry.kind === previous.kind
    ? { ...route, view: { kind: "target", target } }
    : {
        ...route,
        view: { kind: "missing", requested: `view/${previous.path}/` },
      };
}
