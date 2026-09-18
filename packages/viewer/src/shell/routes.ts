/** URL-derived route state for the standalone hydrated shell. */

import { isLogicalFragment } from "../navigation/logical.js";

import { catalogueRouteEntry, type Catalogue } from "./catalogue.js";
import { toRouteTarget } from "./target.js";
import type { ShellView } from "./views.js";

/** Route state whose view identity always comes from the document URL. */
export interface ShellRoute {
  view: ShellView;
  fragment?: string;
  variant?: string;
}

/** Resolve a browser URL strictly against the accepted catalogue snapshot. */
export function routeFromUrl(catalogue: Catalogue, url: URL): ShellRoute {
  const entry = routeEntry(catalogue, url.pathname);
  const target = entry ? toRouteTarget(entry) : undefined;
  const view = target
    ? { kind: "target" as const, target }
    : url.pathname === "/"
      ? { kind: "home" as const }
      : { kind: "missing" as const, requested: requestedPath(url.pathname) };
  const fragments = url.searchParams.getAll("fragment");
  const variants = url.searchParams.getAll("variant");
  const variant =
    entry?.kind === "component" &&
    variants.length === 1 &&
    entry.variants.some((item) => item.id === variants[0])
      ? variants[0]
      : undefined;
  return {
    view,
    ...(fragments.length === 1 && isLogicalFragment(fragments[0])
      ? { fragment: fragments[0] }
      : {}),
    ...(variant ? { variant } : {}),
  };
}

/** Canonical URL for a validated catalogue entry and logical fragment. */
export function routeHref(
  route: string,
  fragment?: string,
  variant?: string,
): string {
  const url = new URL(
    `/view/${route.split("/").map(encodeURIComponent).join("/")}`,
    "https://mokly.invalid",
  );
  if (fragment) url.searchParams.set("fragment", fragment);
  if (variant) url.searchParams.set("variant", variant);
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

function routeEntry(catalogue: Catalogue, pathname: string) {
  if (pathname.startsWith("/view/")) {
    const route = decodePath(pathname.slice("/view/".length));
    return route === undefined
      ? undefined
      : catalogueRouteEntry(catalogue, route);
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
