/** The entry details one shell route needs, and how each request fares. */

import {
  currentEntry,
  detailKey,
  fenceDetail,
  workspaceDetailRequest,
  type DetailRequest,
} from "../catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  DeploymentFileV1,
  EntryDetailV3,
} from "../catalogue/types.js";
import { MoklyVersionError } from "../catalogue/version_error.js";

import type { ShellDataSource } from "./data_source.js";
import type { ShellRoute } from "./routes.js";

/**
 * How one route's detail is delivered to the workspace and the stage.
 * `replaced`: another deployment replaced the catalogue before the details
 * arrived; a full page load or the host's new index brings the new data.
 */
export type DetailDelivery =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "failed"; retry(): void }
  | { status: "replaced" };

/**
 * The details a route renders from: the routed entry's own, a current
 * component variant's parent, and each use-case step screen. Only an entry or
 * a removed record that the given index lists has a detail, so a publication
 * that drops or renames the routed entry requests none and installs; the route
 * then shows the missing state.
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
  const workspace = workspaceDetailRequest(entry, true);
  if (workspace.path !== entry.path) requests.push(workspace);
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
  | { kind: "accepted"; detail: EntryDetailV3; index: CatalogueReadModel }
  | { kind: "deployment" }
  | { kind: "version"; error: MoklyVersionError }
  | { kind: "failed" };

/** Start one optional static deployment check for a page change. */
export function startDeploymentCheck(
  source: ShellDataSource,
  requests: readonly DetailRequest[],
):
  | {
      controller: AbortController;
      promise: Promise<DeploymentFileV1 | undefined>;
    }
  | undefined {
  if (!source.loadDeployment || !requests.length) return undefined;
  const controller = new AbortController();
  return {
    controller,
    promise: source.loadDeployment(controller.signal).catch(() => undefined),
  };
}

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
  deployment?: Promise<DeploymentFileV1 | undefined>,
): Promise<DetailOutcome> {
  const deploymentResult = deployment?.catch(() => undefined);
  const outcome = await loadDetailPair(source, index, request, signal);
  if (outcome.kind === "accepted" || outcome.kind === "deployment")
    return outcome;
  const deploymentFile = await deploymentResult;
  return deploymentFile !== undefined &&
    deploymentFile.deploymentId !== index.deploymentId
    ? { kind: "deployment" }
    : outcome;
}

/** Read and fence a pair independently of the optional deployment check. */
async function loadDetailPair(
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
      details: readonly (readonly [DetailRequest, EntryDetailV3])[];
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
function routeReady(
  held: ReadonlyMap<string, EntryDetailV3>,
  requests: readonly DetailRequest[],
): boolean {
  return requests.every((request) => held.has(detailKey(request)));
}

/** What the delivery of one route's details is decided from. */
export interface RouteDeliveryInput {
  /** The details that the installed snapshot holds. */
  details: ReadonlyMap<string, EntryDetailV3>;
  /** The keys of the requested details whose last load failed. */
  failed: ReadonlySet<string>;
  /** Whether the route's last publication refresh failed. */
  refreshFailed: boolean;
  /** Whether another deployment replaced the catalogue. */
  replaced: boolean;
  requests: readonly DetailRequest[];
  retry(keys: readonly string[]): void;
  retryRefresh(): void;
}

/**
 * The delivery of one route's details. A catalogue that another deployment
 * replaced outranks a failed load or refresh: a route that still waits for a
 * detail shows it replaced, and a route whose details all arrived keeps them.
 * A failed detail or a failed publication refresh fails the route only after
 * every detail has arrived or failed, because a detail that still loads can
 * show another deployment.
 */
export function routeDetailDelivery(
  input: RouteDeliveryInput,
): DetailDelivery | undefined {
  const { requests } = input;
  if (!requests.length) return undefined;
  const ready = routeReady(input.details, requests);
  if (input.replaced)
    return ready ? { status: "ready" } : { status: "replaced" };
  const keys = requests.map(detailKey);
  const settled = keys.every(
    (key) => input.details.has(key) || input.failed.has(key),
  );
  if (!settled) return { status: "loading" };
  if (input.refreshFailed)
    return { status: "failed", retry: input.retryRefresh };
  if (ready) return { status: "ready" };
  return { status: "failed", retry: () => input.retry(keys) };
}
