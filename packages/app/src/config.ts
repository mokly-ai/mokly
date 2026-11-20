import { isDesktopShell } from "./navigation/desktop-shell";

/**
 * The API serves `/v1`. The public app origin supplies the addresses the
 * product shows and the public site links, including Home, Docs and Changelog.
 */
function envOrigin(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.replace(/\/+$/, "") : fallback;
}

/**
 * The page's own origin where it is also the public one: a browser tab, which
 * shares its origin with the public site. The desktop shell serves the page
 * from an origin of its own, and server rendering and native runtimes have no
 * browser location, so none of them has a public origin to offer.
 */
function publicPageOrigin(): string | undefined {
  if (typeof window === "undefined" || window.location === undefined) {
    return undefined;
  }
  return isDesktopShell() ? undefined : window.location.origin;
}

/** The public app origin: the configured one, else the page's or the local default. */
export function appOriginFor(configured: string | undefined): string {
  return envOrigin(configured, publicPageOrigin() ?? "http://localhost:8081");
}

/** The API base URL; `/v1` paths are appended to it. */
export const apiOrigin = envOrigin(
  process.env.EXPO_PUBLIC_MKC_API_ORIGIN,
  "http://localhost:8080",
);

/** The public app origin for the addresses the product shows and for site links. */
export const appOrigin = appOriginFor(process.env.EXPO_PUBLIC_MKC_APP_ORIGIN);

/** A concise user-facing address on the configured public application origin. */
export function appAddress(path: string): string {
  const address = new URL(path || "/", appOrigin);
  return address.host + address.pathname;
}

/**
 * The origin of the public site: the page's own in a browser tab, and the
 * configured public app origin in the desktop shell and outside a browser.
 */
export function siteOriginFor(publicAppOrigin: string): string {
  return publicPageOrigin() ?? publicAppOrigin;
}

/** Outbound destinations on the public site at one origin. */
export function siteLinks(origin: string) {
  return {
    home: origin + "/",
    docs: origin + "/docs",
    changelog: origin + "/changelog",
    pricing: origin + "/pricing",
    terms: origin + "/terms",
    privacy: origin + "/privacy",
    /** The CI setup guide, which the installed package's guides publish. */
    publishFromCi: origin + "/docs/ci/publish-from-ci/",
  };
}

/** The public website that owns Home, Docs, Changelog, Terms and Privacy. */
export const siteOrigin = siteOriginFor(appOrigin);

/** Outbound destinations on the public site. */
export const site = siteLinks(siteOrigin);
