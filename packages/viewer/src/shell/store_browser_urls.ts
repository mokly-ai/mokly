import type { ViewerSelection } from "../host/types.js";
import { parseViewHref, viewHref } from "../navigation/routes.js";

import type { routeFromUrl } from "./routes.js";

/**
 * The address that names the viewport which the reader chose on the shown
 * entry: its `viewport` query takes the value in place, and every other part
 * of the address stays.
 */
export function viewportUrl(
  url: URL,
  viewport: ViewerSelection["viewport"],
): URL {
  const next = new URL(url);
  next.searchParams.set("viewport", viewport);
  return next;
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
