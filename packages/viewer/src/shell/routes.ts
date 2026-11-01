/** URL-derived route state for the standalone shell. */

import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import { isHistoricalSnapshotId } from "../catalogue/snapshot_identity.js";
import { isLogicalFragment } from "../navigation/logical.js";
import { parseViewHref, viewHref } from "../navigation/routes.js";
import { parseViewAxes } from "../navigation/view_axes.js";

import type { Catalogue } from "./catalogue.js";
import { toRouteTarget } from "./target.js";
import type { ShellView } from "./views.js";

/** Route state whose view identity always comes from the document URL. */
export interface ShellRoute {
  view: ShellView;
  colorScheme?: "dark" | "light";
  comparison?: "side";
  fragment?: string;
  instance?: string;
  snapshot?: string;
  viewport?: "both" | "desktop" | "mobile";
}

/** Resolve a browser URL strictly against the accepted catalogue snapshot. */
export function routeFromUrl(catalogue: Catalogue, url: URL): ShellRoute {
  const identity = parseViewHref(url.pathname);
  const snapshots = url.searchParams.getAll("snapshot");
  const requestedSnapshot =
    snapshots.length === 1 && isHistoricalSnapshotId(snapshots[0])
      ? snapshots[0]
      : undefined;
  const selected =
    identity && (snapshots.length === 0 || requestedSnapshot !== undefined)
      ? resolveCatalogueSelection(
          catalogue.publicModel,
          identity,
          requestedSnapshot,
        )
      : undefined;
  const snapshot = selected?.snapshotId;
  const target = selected && toRouteTarget(selected.entry);
  const view = target
    ? { kind: "target" as const, target }
    : url.pathname === "/" && snapshots.length === 0
      ? { kind: "home" as const }
      : { kind: "missing" as const, requested: requestedPath(url.pathname) };
  const fragments = url.searchParams.getAll("fragment");
  const axes = parseViewAxes(url.searchParams);
  const instances = url.searchParams.getAll("instance");
  const comparisons = url.searchParams.getAll("comparison");
  return {
    view,
    ...axes,
    ...(snapshot ? { snapshot } : {}),
    ...(instances.length === 1 && /^[a-f0-9]{64}$/.test(instances[0] ?? "")
      ? { instance: instances[0] }
      : {}),
    ...(comparisons.length === 1 && comparisons[0] === "side"
      ? { comparison: "side" as const }
      : {}),
    ...(fragments.length === 1 && isLogicalFragment(fragments[0])
      ? { fragment: fragments[0] }
      : {}),
  };
}

/** Canonical URL for a validated catalogue entry and logical fragment. */
export function routeHref(
  id: string,
  fragment?: string,
  workspace: Pick<
    ShellRoute,
    "colorScheme" | "comparison" | "instance" | "snapshot" | "viewport"
  > = {},
): string {
  const url = new URL(viewHref(id), "https://mokly.invalid");
  if (fragment) url.searchParams.set("fragment", fragment);
  if (workspace.viewport) url.searchParams.set("viewport", workspace.viewport);
  if (workspace.colorScheme)
    url.searchParams.set("scheme", workspace.colorScheme);
  if (workspace.instance) url.searchParams.set("instance", workspace.instance);
  if (workspace.snapshot) url.searchParams.set("snapshot", workspace.snapshot);
  if (workspace.comparison)
    url.searchParams.set("comparison", workspace.comparison);
  return `${url.pathname}${url.search}`;
}

/** Stable route identity excludes native same-document hash navigation. */
export function routeDocumentKey(url: URL): string {
  return `${url.origin}${url.pathname}${url.search}`;
}

/** Screen selection represented by a resolved route. */
export function routeScreenId(route: ShellRoute): string | null {
  return route.view.kind === "target" ? route.view.target.entry.path : null;
}

function decodePath(value: string): string | undefined {
  const decoded = value.split("/").map(decodeSegment);
  return decoded.some((part) => part === undefined)
    ? undefined
    : (decoded as string[]).join("/");
}

function decodeSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function requestedPath(pathname: string): string {
  return decodePath(pathname.replace(/^\//, "")) ?? pathname;
}
