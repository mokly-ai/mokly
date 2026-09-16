/**
 * The public site's routes and the application routes it links to. The
 * header, the footer, the sitemap and the browser walk all read this module
 * so one table decides where the site can go.
 */

/** Every site route, in the reading order the footer's Product column uses. */
export const SITE_PATHS = {
  home: "/",
  docs: "/docs/",
  changelog: "/changelog/",
  terms: "/terms/",
  privacy: "/privacy/",
} as const;

/** One of the site's own routes. */
export type SitePath = (typeof SITE_PATHS)[keyof typeof SITE_PATHS];

/** The routes published in `sitemap.xml`; the 404 document is excluded. */
export const SITEMAP_PATHS: readonly SitePath[] = Object.freeze([
  SITE_PATHS.home,
  SITE_PATHS.docs,
  SITE_PATHS.changelog,
  SITE_PATHS.terms,
  SITE_PATHS.privacy,
]);

/**
 * Sign in and Get started are Mokly Cloud routes, not site routes. They
 * resolve against the configured application origin and carry no
 * tracking parameters.
 */
export const APP_PATHS = {
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;

/** One of the application routes the site links to. */
export type AppPath = (typeof APP_PATHS)[keyof typeof APP_PATHS];

/** Resolve an application route against the configured application origin. */
export function appLink(appOrigin: string, path: AppPath): string {
  return `${appOrigin}${path}`;
}

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
