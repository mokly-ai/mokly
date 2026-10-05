import { parseViewHref, viewHref } from "../navigation/routes.js";

import type { routeFromUrl } from "./routes.js";

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
