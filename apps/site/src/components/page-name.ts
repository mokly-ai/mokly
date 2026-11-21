/**
 * The page name of each route: the name that the tool bar's file title and
 * the footer's status bar show after `mokly.ai —`, as in `mokly.ai — Docs`.
 * Every documentation route is Docs, and the not-found document is 404.
 */

import { NOT_FOUND_ROUTE, type PageRoute } from "../metadata.js";
import { SITE_PATHS, isDocsRoute } from "../navigation.js";

/** The page name of every published document, by route. */
const PAGE_NAMES: Readonly<Record<PageRoute, string>> = {
  [SITE_PATHS.home]: "Home",
  [SITE_PATHS.docs]: "Docs",
  [SITE_PATHS.changelog]: "Changelog",
  [SITE_PATHS.terms]: "Terms",
  [SITE_PATHS.privacy]: "Privacy",
  [SITE_PATHS.complaints]: "Complaints",
  [SITE_PATHS.security]: "Security",
  [NOT_FOUND_ROUTE]: "404",
};

/** Whether a route is one of the site's published documents. */
function isPageRoute(route: string): route is PageRoute {
  return Object.hasOwn(PAGE_NAMES, route);
}

/**
 * The page name of a route. A route that names no published document is
 * the not-found document, so it takes that document's name.
 */
export function pageName(route: string): string {
  if (isDocsRoute(route)) return PAGE_NAMES[SITE_PATHS.docs];
  return PAGE_NAMES[isPageRoute(route) ? route : NOT_FOUND_ROUTE];
}
