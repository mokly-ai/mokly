import type { ColorScheme, Viewport } from "../data/axes.js";

import { isEntryPath, isSafeRepositoryPath } from "./logical.js";

/** Entry kinds with canonical catalogue documents. */
export type EntryRouteKind =
  "component" | "document" | "page" | "screen" | "use-case";
/** Entry kinds that own viewport renderings. */
export type ViewRouteKind = "component" | "screen";
/** Side of a retained comparison snapshot. */
export type SnapshotSide = "after" | "before";

/** Derive an entry's logical document route. */
export function entryRoute(path: string): string {
  requirePathValue(isEntryPath(path));
  return `${path}/index.html`;
}

/** Derive one viewport and color-scheme document. */
export function viewRoute(
  path: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string {
  requirePathValue(viewport === "mobile" || viewport === "desktop");
  requireScheme(colorScheme);
  return entryRoute(path).replace(
    /\.html$/,
    `.${viewport}${colorScheme === "dark" ? ".dark" : ""}.html`,
  );
}

/** Derive a complete page or document's rendered file. */
export function documentRoute(path: string, colorScheme: ColorScheme): string {
  requireScheme(colorScheme);
  return entryRoute(path).replace(
    /\.html$/,
    `${colorScheme === "dark" ? ".dark" : ""}.html`,
  );
}

/** Derive the canonical shell URL. */
export function viewHref(path: string): string {
  requirePathValue(isEntryPath(path));
  return `/view/${path}/`;
}

/** Derive one retained view document beneath its comparison side. */
export function snapshotViewPath(
  side: SnapshotSide,
  path: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string {
  return snapshotResourcePath(side, viewRoute(path, viewport, colorScheme));
}

/** Derive one retained complete document beneath its comparison side. */
export function snapshotDocumentPath(
  side: SnapshotSide,
  path: string,
  colorScheme: ColorScheme,
): string {
  return snapshotResourcePath(side, documentRoute(path, colorScheme));
}

/** Derive a comparison side's directory prefix. */
export function snapshotSidePath(side: SnapshotSide): string {
  requirePathValue(side === "before" || side === "after");
  return `snapshots/${side}/`;
}

/** Derive a confined resource path beneath a comparison side. */
export function snapshotResourcePath(
  side: SnapshotSide,
  route: string,
): string {
  requirePathValue(isSafeRepositoryPath(route));
  return `${snapshotSidePath(side)}${route}`;
}

/** Derive historical preview metadata within a comparison generation. */
export function previewMetadataPath(path: string): string {
  requirePathValue(isEntryPath(path));
  return `previews/${path}/index.json`;
}

/** Parse the three accepted shell URL forms without guessing an entry's kind. */
export function parseViewHref(value: string): string | undefined {
  if (
    !value.startsWith("/view/") ||
    /[?#]/.test(value) ||
    /%(?:2f|5c)/i.test(value)
  )
    return undefined;
  const raw = value.slice(6).replace(/\/index\.html$|\/$/, "");
  try {
    const path = raw.split("/").map(decodeURIComponent).join("/");
    return isEntryPath(path) ? path : undefined;
  } catch {
    return undefined;
  }
}

/** Normalize confined shell documents and static HTML artifacts for a host. */
export function providerNormalizedHtmlPath(
  pathname: string,
): string | undefined {
  if (/[?#]/.test(pathname) || /%(?:2f|5c)/i.test(pathname)) return undefined;
  if (pathname.startsWith("/view/")) {
    if (!pathname.endsWith("/") && !pathname.endsWith("/index.html"))
      return undefined;
    const path = parseViewHref(pathname);
    return path === undefined ? undefined : viewHref(path);
  }
  if (!pathname.startsWith("/static/") || !pathname.endsWith(".html"))
    return undefined;
  try {
    if (!isSafeRepositoryPath(decodeURIComponent(pathname.slice(8))))
      return undefined;
  } catch {
    return undefined;
  }
  return pathname.endsWith("/index.html")
    ? pathname.slice(0, -"index.html".length)
    : pathname.slice(0, -5);
}

function requireScheme(value: ColorScheme): void {
  requirePathValue(value === "light" || value === "dark");
}
function requirePathValue(valid: boolean): asserts valid {
  if (!valid)
    throw new Error("[mokly/navigation/routes] invalid artifact path");
}
