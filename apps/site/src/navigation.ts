/**
 * The public site's routes, root outputs, Get started path and application
 * route. The header, menu, footer, sitemap, route generator, link check and
 * browser walk read this module.
 */

/** Every site route, in the reading order the footer's Product column uses. */
export const SITE_PATHS = {
  home: "/",
  docs: "/docs/",
  changelog: "/changelog/",
  pricing: "/pricing/",
  terms: "/terms/",
  privacy: "/privacy/",
  complaints: "/complaints/",
  security: "/security/",
} as const;

/**
 * Top-level build outputs that are not represented by a navigable site route.
 * The origin router reserves these names for the static site alongside the
 * first segment of every route above.
 */
export const SITE_OUTPUT_FIRST_SEGMENTS = Object.freeze([
  "_astro",
  "brand",
  "changelog.xml",
  "favicon.svg",
  "og",
  "pagefind",
  "robots.txt",
  "sitemap.xml",
  "stage",
] as const);

/** One of the site's own routes. */
export type SitePath = (typeof SITE_PATHS)[keyof typeof SITE_PATHS];

/**
 * The one application route that the pricing page's plan actions open.
 * This relative path shares the site origin, and the origin router sends it
 * to the app. The link check accepts it without a site file.
 */
export const APP_PATHS = { signUp: "/sign-up" } as const;

/** The application route linked from the site. */
export type AppPath = (typeof APP_PATHS)[keyof typeof APP_PATHS];

/** The routes published in `sitemap.xml`; the 404 document is excluded. */
export const SITEMAP_PATHS: readonly SitePath[] = Object.freeze([
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SITE_PATHS.pricing,
  SITE_PATHS.terms,
  SITE_PATHS.privacy,
  SITE_PATHS.complaints,
  SITE_PATHS.security,
]);

/** Public destinations outside the site and application origins. */
export const EXTERNAL_LINKS = {
  desktopReleases: "https://github.com/mokly-ai/mokly-desktop/releases",
  github: "https://github.com/mokly-ai/mokly",
} as const;

/**
 * Where Get started goes: the first Getting started guide, which the
 * installed `@mokly/mokly` package publishes under the documentation.
 */
export const GET_STARTED_PATH = "/docs/start/install/";

/** Documentation routes all live under the documentation landing page. */
export function isDocsRoute(route: string): boolean {
  return route.startsWith(SITE_PATHS.docs);
}

/**
 * Mark a header or footer link when it addresses the rendered route. Every
 * documentation route marks Docs; the other routes match exactly.
 */
export function currentPage(
  route: string,
  target: SitePath,
): "page" | undefined {
  const current =
    target === SITE_PATHS.docs ? isDocsRoute(route) : route === target;
  return current ? "page" : undefined;
}
