import type { ViewerSelection } from "../host/types.js";
import { parseViewHref, viewHref } from "../navigation/routes.js";

import { routeHref, type routeFromUrl, type ShellRoute } from "./routes.js";

/** The selection's viewport, which a standalone shell's address names. */
type Viewport = ViewerSelection["viewport"];

/**
 * The address that names a viewport: Mobile or Desktop in its `viewport`
 * query, and Both by the query's absence. Every other part of the address
 * stays.
 */
export function viewportUrl(url: URL, viewport: Viewport): URL {
  const next = new URL(url);
  if (viewport === "both") next.searchParams.delete("viewport");
  else next.searchParams.set("viewport", viewport);
  return next;
}

/**
 * The viewport that a destination of a standalone shell shows: the one that
 * its link or the Changes landing names; else, on a navigation, the kept
 * viewport of the selection; and else, on a history step, Both, because an
 * address without `viewport` names Both.
 */
export function destinationViewport(
  named: Viewport | undefined,
  kept: Viewport,
  navigation: boolean,
): Viewport {
  return named ?? (navigation ? kept : "both");
}

/** The route with `viewport`, which names no viewport for Both. */
export function routeWithViewport(
  route: ShellRoute,
  viewport: Viewport,
): ShellRoute {
  const { viewport: _named, ...rest } = route;
  return viewport === "both" ? rest : { ...rest, viewport };
}

/**
 * The canonical address of a destination that shows `viewport`: an entry's
 * `/view/{path}/` address with its fragment and its queries in their order,
 * and the requested hash; any other destination's normalized address.
 */
export function destinationUrl(
  requested: URL,
  route: ShellRoute,
  viewport: Viewport,
): URL {
  const shown = routeWithViewport(route, viewport);
  if (shown.view.kind !== "target")
    return canonicalRouteUrl(viewportUrl(requested, viewport), shown);
  const url = new URL(
    routeHref(shown.view.target.entry.path, shown.fragment, shown),
    requested,
  );
  url.hash = requested.hash;
  return url;
}

/** Normalize every accepted entry URL and pin inferred historical identity. */
export function canonicalRouteUrl(
  url: URL,
  route: ReturnType<typeof routeFromUrl>,
): URL {
  const path = parseViewHref(url.pathname);
  if (path === undefined) return url;
  const canonical = new URL(url);
  canonical.pathname = viewHref(path);
  if (
    route.view.kind === "target" &&
    route.snapshot &&
    !canonical.searchParams.has("snapshot")
  )
    canonical.searchParams.set("snapshot", route.snapshot);
  return canonical.href === url.href ? url : canonical;
}
