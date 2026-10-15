/** The entry details one shell route needs, and how each request fares. */

import {
  currentEntry,
  detailKey,
  fenceDetail,
  type DetailRequest,
} from "../catalogue/detail_fences.js";
import type { CatalogueReadModel, EntryDetailV1 } from "../catalogue/types.js";
import { MoklyVersionError } from "../catalogue/version_error.js";

import type { ShellDataSource } from "./data_source.js";
import type { ShellRoute } from "./routes.js";

/** How one route's detail is delivered to the workspace and the stage. */
export type DetailDelivery =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "failed"; retry(): void };

/**
 * The details a route renders from: the routed entry's own, and for a use
 * case the detail of each step screen, whose views its frames inspect. Only
 * an entry or a removed record that the given index lists has a detail, so a
 * publication that drops or renames the routed entry requests none and
 * installs; the route then shows the missing state.
 */
export function routeDetailRequests(
  index: CatalogueReadModel,
  route: ShellRoute,
): readonly DetailRequest[] {
  if (route.view.kind !== "target") return [];
  const routed = route.view.target.entry;
  const snapshotId = route.snapshot;
  if (snapshotId !== undefined)
    return index.comparisonUrl !== null &&
      index.removedEntries.some(
        (record) =>
          record.snapshotId === snapshotId &&
          record.entry.path === routed.path &&
          record.entry.kind === routed.kind,
      )
      ? [{ path: routed.path, snapshotId }]
      : [];
  const entry = currentEntry(index, routed.path);
  if (entry?.kind !== routed.kind) return [];
  const requests: DetailRequest[] = [{ path: entry.path }];
  if (entry.kind === "use-case")
    for (const step of entry.steps)
      if (
        !requests.some((request) => request.path === step.screenPath) &&
        index.screens.some((screen) => screen.path === step.screenPath)
      )
        requests.push({ path: step.screenPath });
  return requests;
}

/** The outcome of loading one detail against the installed index. */
export type DetailOutcome =
  | { kind: "accepted"; detail: EntryDetailV1; index: CatalogueReadModel }
  | { kind: "deployment" }
  | { kind: "version"; error: MoklyVersionError }
  | { kind: "failed" };

/**
 * Load one detail and apply its fence. On a revision mismatch the index is
 * requested once more; an index of another deployment, or a pair that still
 * disagrees, does not install.
 */
export async function loadFencedDetail(
  source: ShellDataSource,
  index: CatalogueReadModel,
  request: DetailRequest,
  signal: AbortSignal,
): Promise<DetailOutcome> {
  try {
    const detail = await source.loadDetail(request, index, signal);
    let fence = fenceDetail(index, request, detail);
    let installed = index;
    if (fence.kind === "revision") {
      installed = await source.loadIndex(signal);
      if (installed.deploymentId !== index.deploymentId)
        return { kind: "deployment" };
      fence = fenceDetail(installed, request, detail);
      if (fence.kind === "revision") return { kind: "failed" };
    }
    if (fence.kind === "deployment") return { kind: "deployment" };
    if (fence.kind === "rejected") return { kind: "failed" };
    return { kind: "accepted", detail: fence.detail, index: installed };
  } catch (error) {
    if (error instanceof MoklyVersionError) return { kind: "version", error };
    return { kind: "failed" };
  }
}

/** The outcome of one publication refresh. */
export type RefreshOutcome =
  | {
      kind: "accepted";
      index: CatalogueReadModel;
      details: readonly (readonly [DetailRequest, EntryDetailV1])[];
    }
  | { kind: "deployment" }
  | { kind: "version"; error: MoklyVersionError }
  | { kind: "failed" };

/**
 * Fetch the index and the current route's details, and require one revision
 * on both at or above the message's. The index is requested once more when
 * the pair disagrees; a route change while they load starts again.
 */
export async function loadRefresh(
  source: ShellDataSource,
  installed: CatalogueReadModel,
  route: () => ShellRoute,
  revision: number,
  signal: AbortSignal,
): Promise<RefreshOutcome> {
  try {
    let restarts = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const index = await source.loadIndex(signal);
      if (index.deploymentId !== installed.deploymentId)
        return { kind: "deployment" };
      const requested = routeKey(route());
      const requests = routeDetailRequests(index, route());
      const details = await Promise.all(
        requests.map((request) => source.loadDetail(request, index, signal)),
      );
      if (routeKey(route()) !== requested && restarts < 4) {
        restarts += 1;
        attempt -= 1;
        continue;
      }
      const fences = requests.map((request, at) =>
        fenceDetail(index, request, details[at]!),
      );
      if (fences.some((fence) => fence.kind === "deployment"))
        return { kind: "deployment" };
      if (
        index.revision >= revision &&
        fences.every((fence) => fence.kind === "accepted")
      )
        return {
          kind: "accepted",
          index,
          details: requests.map((request, at) => [request, details[at]!]),
        };
    }
    return { kind: "failed" };
  } catch (error) {
    if (error instanceof MoklyVersionError) return { kind: "version", error };
    return { kind: "failed" };
  }
}

/** The identity of the entry one route renders, independent of object identity. */
export function routeKey(route: ShellRoute): string {
  return route.view.kind === "target"
    ? `${route.view.target.entry.path}\u0000${route.snapshot ?? ""}`
    : route.view.kind;
}

/** Whether every request of a route has an accepted detail. */
export function routeReady(
  held: ReadonlyMap<string, EntryDetailV1>,
  requests: readonly DetailRequest[],
): boolean {
  return requests.every((request) => held.has(detailKey(request)));
}
