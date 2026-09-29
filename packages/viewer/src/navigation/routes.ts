import type { ColorScheme, Viewport } from "../data/axes.js";

import { isEntryId } from "./logical.js";

/** Entry kinds with canonical catalogue documents. */
export type EntryRouteKind = "component" | "page" | "screen" | "use-case";

/** Entry kinds that own viewport and color-scheme renderings. */
export type ViewRouteKind = "component" | "screen";

/** Identity parsed from a canonical or provider-normalized shell URL. */
export interface ViewHrefIdentity {
  id: string;
  kind: EntryRouteKind;
}

/** Side of a retained comparison snapshot. */
export type SnapshotSide = "after" | "before";

const PREFIX_BY_KIND = new Map<EntryRouteKind, string>([
  ["component", "components"],
  ["page", "pages"],
  ["screen", "screens"],
  ["use-case", "user-flows"],
]);

const KIND_BY_PREFIX = new Map<string, EntryRouteKind>([
  ["components", "component"],
  ["pages", "page"],
  ["screens", "screen"],
  ["user-flows", "use-case"],
]);

/** Derive an entry's canonical document route from its kind and id. */
export function entryRoute(kind: EntryRouteKind, id: string): string {
  return `${PREFIX_BY_KIND.get(kind)}/${id}.html`;
}

/** Derive one viewport and color-scheme document from entry identity. */
export function viewRoute(
  kind: ViewRouteKind,
  id: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string {
  const scheme = colorScheme === "dark" ? ".dark" : "";
  return entryRoute(kind, id).replace(/\.html$/, `.${viewport}${scheme}.html`);
}

/** Derive the canonical shell URL for an entry. */
export function viewHref(kind: EntryRouteKind, id: string): string {
  return `/view/${entryRoute(kind, id)}`;
}

/** Derive one retained view document beneath its comparison side. */
export function snapshotViewPath(
  side: SnapshotSide,
  kind: ViewRouteKind,
  id: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string {
  requirePathValue(
    (side === "before" || side === "after") &&
      (kind === "screen" || kind === "component") &&
      (viewport === "mobile" || viewport === "desktop") &&
      (colorScheme === "light" || colorScheme === "dark") &&
      isEntryId(id),
  );
  return snapshotResourcePath(side, viewRoute(kind, id, viewport, colorScheme));
}

/** Derive a removed page's retained before document. */
export function snapshotPagePath(id: string): string {
  requirePathValue(isEntryId(id));
  return snapshotResourcePath("before", entryRoute("page", id));
}

/** Derive one retained comparison side's directory prefix. */
export function snapshotSidePath(side: SnapshotSide): string {
  requirePathValue(side === "before" || side === "after");
  return `snapshots/${side}/`;
}

/** Derive one confined resource path beneath a retained comparison side. */
export function snapshotResourcePath(
  side: SnapshotSide,
  route: string,
): string {
  requirePathValue(isConfinedStaticPath(route));
  return `${snapshotSidePath(side)}${route}`;
}

/** Derive a removed page's metadata file within a comparison generation. */
export function pagePreviewMetadataPath(id: string): string {
  requirePathValue(isEntryId(id));
  return `pages/${id}.json`;
}

/** Parse a canonical or provider-normalized `/view/<route>` pathname. */
export function parseViewHref(value: string): ViewHrefIdentity | undefined {
  const match = /^\/view\/([^/]+)\/([^/]+?)(?:\.html)?$/.exec(value);
  if (!match) return undefined;
  const prefix = match[1] ?? "";
  const id = match[2] ?? "";
  const kind = KIND_BY_PREFIX.get(prefix);
  if (!kind || !isEntryId(id)) return undefined;
  return { id, kind };
}

/** Strip the final HTML suffix from a confined canonical browser path. */
export function providerNormalizedHtmlPath(
  pathname: string,
): string | undefined {
  if (
    !pathname.endsWith(".html") ||
    pathname.includes("?") ||
    pathname.includes("#") ||
    /%(?:2f|5c)/i.test(pathname)
  )
    return undefined;
  if (pathname.startsWith("/view/")) {
    const identity = parseViewHref(pathname);
    if (!identity || viewHref(identity.kind, identity.id) !== pathname)
      return undefined;
    return pathname.slice(0, -5);
  }
  if (!pathname.startsWith("/static/")) return undefined;
  const relative = pathname.slice("/static/".length);
  if (!isConfinedStaticPath(relative) || hasEncodedDotSegment(relative))
    return undefined;
  return pathname.slice(0, -5);
}

/** Name the deliberately noncanonical view used for an unknown logical id. */
export function unavailableViewHref(id: string): string {
  return `/view/${encodeURIComponent(id)}`;
}

function hasEncodedDotSegment(path: string): boolean {
  return path.split("/").some((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === "." || decoded === "..";
    } catch {
      return true;
    }
  });
}

function isConfinedStaticPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\\") &&
    !path.includes(":") &&
    !path.includes("\0") &&
    !path.split("/").some((part) => !part || part === "." || part === "..")
  );
}

function requirePathValue(valid: boolean): asserts valid {
  if (!valid)
    throw new Error("[mokly/navigation/routes] invalid artifact path");
}
