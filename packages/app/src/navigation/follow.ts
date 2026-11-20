/** The router operation an application route is reached through. */
export interface RouteRouter {
  push: (href: string) => void;
}

/**
 * Schemes whose address runs in this page rather than leaving it. No
 * destination may name one, so an address that does is never followed.
 */
const runsInPage = /^(?:javascript|vbscript|data):/i;

/**
 * Whether an address leaves the application rather than naming one of its
 * routes: it carries a scheme of its own — another site, or another program
 * such as the desktop shell — or names another host.
 */
export function leavesApplication(href: string): boolean {
  return /^[A-Za-z][A-Za-z\d+.-]*:/.test(href) || href.startsWith("//");
}

/**
 * Go to one destination. The router is for this application's own routes, so
 * in a browser the page opens an address outside the application itself, in
 * this tab, and where that address goes never depends on how the router reads
 * it. Without a browser location, as on iOS and Android, the router hands such
 * an address to the platform.
 */
export function follow(href: string, router: RouteRouter): void {
  if (runsInPage.test(href)) return;
  const page = typeof window === "undefined" ? undefined : window.location;
  if (page !== undefined && leavesApplication(href)) {
    page.assign(href);
    return;
  }
  router.push(href);
}
