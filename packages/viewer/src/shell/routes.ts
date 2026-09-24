/** URL-derived route state for the standalone hydrated shell. */

import { isHistoricalSnapshotId } from "../catalogue/snapshot_identity.js";
import type { StaticDelivery } from "../navigation/delivery.js";
import { isLogicalFragment } from "../navigation/logical.js";
import { parseViewAxes } from "../navigation/view_axes.js";
import type { ManifestEntry } from "../registry/types.js";

import { catalogueRouteEntry, type Catalogue } from "./catalogue.js";
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
  variant?: string;
  /** Every component variant query value, including invalid empty or duplicate values. */
  variantValues?: readonly string[];
  viewport?: "both" | "desktop" | "mobile";
}

/** Resolve a browser URL strictly against the accepted catalogue snapshot. */
export function routeFromUrl(
  catalogue: Catalogue,
  url: URL,
  delivery?: StaticDelivery,
): ShellRoute {
  const entry = routeEntry(catalogue, url.pathname, delivery);
  const snapshots = url.searchParams.getAll("snapshot");
  const historical = entry
    ? catalogue.removedEntries.find(
        ({ entry: candidate }) => candidate.route === entry.route,
      )
    : undefined;
  const alias = /^\/id\//.test(url.pathname);
  const requestedSnapshot =
    snapshots.length === 1 && isHistoricalSnapshotId(snapshots[0])
      ? snapshots[0]
      : undefined;
  const snapshot =
    historical &&
    (snapshots.length === 0 ||
      (!alias && requestedSnapshot === historical.snapshotId))
      ? (requestedSnapshot ?? historical.snapshotId)
      : undefined;
  const collidingLegacy =
    historical !== undefined &&
    historical.snapshotId === undefined &&
    catalogue.manifest.entries.some(
      (candidate) => candidate.id === historical.entry.id,
    );
  const validSnapshot = historical
    ? snapshot !== undefined || (snapshots.length === 0 && !collidingLegacy)
    : snapshots.length === 0;
  const target = entry && validSnapshot ? toRouteTarget(entry) : undefined;
  const view = target
    ? { kind: "target" as const, target }
    : url.pathname === "/" && snapshots.length === 0
      ? { kind: "home" as const }
      : { kind: "missing" as const, requested: requestedPath(url.pathname) };
  const fragments = url.searchParams.getAll("fragment");
  const variants = url.searchParams.getAll("variant");
  const axes = parseViewAxes(url.searchParams);
  const instances = url.searchParams.getAll("instance");
  const comparisons = url.searchParams.getAll("comparison");
  const variant =
    entry?.kind === "component" && variants.length === 1 && variants[0]
      ? variants[0]
      : undefined;
  const variantValues =
    entry?.kind === "component" && variants.length > 0 ? variants : undefined;
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
    ...(variant ? { variant } : {}),
    ...(variantValues ? { variantValues } : {}),
  };
}

/** Canonical URL for a validated catalogue entry and logical fragment. */
export function routeHref(
  route: string,
  fragment?: string,
  variant?: string,
  workspace: Pick<
    ShellRoute,
    | "colorScheme"
    | "comparison"
    | "instance"
    | "snapshot"
    | "variantValues"
    | "viewport"
  > = {},
): string {
  const url = new URL(
    `/view/${route.split("/").map(encodeURIComponent).join("/")}`,
    "https://mokly.invalid",
  );
  if (fragment) url.searchParams.set("fragment", fragment);
  if (workspace.variantValues)
    for (const value of workspace.variantValues)
      url.searchParams.append("variant", value);
  else if (variant) url.searchParams.set("variant", variant);
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
  return route.view.kind === "target" ? route.view.target.entry.id : null;
}

function routeEntry(
  catalogue: Catalogue,
  pathname: string,
  delivery?: StaticDelivery,
): ManifestEntry | undefined {
  if (pathname.startsWith("/view/")) {
    const route = decodePath(pathname.slice("/view/".length));
    if (route === undefined) return undefined;
    const exact = catalogueRouteEntry(catalogue, route);
    if (exact || !delivery || route.endsWith(".html")) return exact;
    const normalizedRoute = `${route}.html`;
    const normalized = catalogueRouteEntry(catalogue, normalizedRoute);
    if (!normalized) return undefined;
    const canonicalPath = `/view/${normalizedRoute}`;
    const current = Object.values(delivery.idRoutes).includes(canonicalPath);
    const historical = catalogue.removedEntries.some(
      ({ entry }) => entry.route === normalizedRoute,
    );
    return current || historical ? normalized : undefined;
  }
  const match = /^\/id\/([^/]+)(?:\/(?:index\.html)?)?$/.exec(pathname);
  if (!match) return undefined;
  const id = decodeSegment(match[1] ?? "");
  return id === undefined ? undefined : catalogue.byId.get(id);
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
