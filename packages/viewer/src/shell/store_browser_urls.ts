import { providerNormalizedHtmlPath } from "../navigation/routes.js";

import { routeHref } from "./routes.js";
import type { routeFromUrl } from "./routes.js";

/** Pin an inferred historical route before later catalogue evidence can change. */
export function canonicalHistoricalUrl(
  url: URL,
  route: ReturnType<typeof routeFromUrl>,
  providerNormalized: boolean,
): URL {
  if (
    route.view.kind !== "target" ||
    !route.snapshot ||
    url.searchParams.has("snapshot")
  )
    return url;
  return new URL(
    browserRouteHref(
      routeHref(
        route.view.target.entry.kind,
        route.view.target.entry.id,
        route.fragment,
        route,
      ),
      providerNormalized,
    ),
    url,
  );
}

/** Detect a provider-normalized extensionless deployment route. */
export function isProviderNormalizedRoute(
  pathname: string,
  canonicalPath: string | undefined,
): boolean {
  return (
    canonicalPath !== undefined &&
    pathname === providerNormalizedHtmlPath(canonicalPath)
  );
}

/** Match generated links to an extensionless hosting-provider route. */
export function browserRouteHref(
  href: string,
  providerNormalized: boolean,
): string {
  if (!providerNormalized) return href;
  const url = new URL(href, "https://mokly.invalid");
  const pathname = providerNormalizedHtmlPath(url.pathname);
  return pathname === undefined ? href : `${pathname}${url.search}${url.hash}`;
}
