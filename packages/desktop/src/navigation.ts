import type { WebContents } from "electron";

import { DESKTOP_ORIGIN, isDesktopAddress } from "./origin.js";
import { SITE_FIRST_SEGMENTS } from "./site-segments.js";

export type Navigation =
  { action: "allow" | "drop" } | { action: "load" | "external"; url: string };

/**
 * Public product navigation returns to the bundle; public popups and every
 * other HTTP(S) page, Stripe's and GitHub's included, use the browser.
 */
export function navigationTarget(
  address: string,
  appOrigin: string,
  popup = false,
): Navigation {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return { action: "drop" };
  }
  if (url.username || url.password) return { action: "drop" };
  if (isDesktopAddress(url))
    return popup ? { action: "load", url: url.href } : { action: "allow" };
  if (!["http:", "https:"].includes(url.protocol)) return { action: "drop" };
  if (url.origin === appOrigin) {
    let first: string;
    try {
      first = decodeURIComponent(url.pathname.split("/")[1]);
    } catch {
      return { action: "drop" };
    }
    const site =
      url.pathname === "/" ||
      (SITE_FIRST_SEGMENTS as readonly string[]).includes(first);
    return popup || site
      ? { action: "external", url: url.href }
      : {
          action: "load",
          url: DESKTOP_ORIGIN + url.pathname + url.search + url.hash,
        };
  }
  return { action: "external", url: url.href };
}

export interface NavigationDependencies {
  openExternal(url: string): Promise<unknown>;
  load(url: string): Promise<unknown>;
  warn(error: unknown): void;
}

/** Guard renderer navigations and redirects before hosted product requests leave. */
export function installNavigation(
  contents: Pick<WebContents, "on" | "setWindowOpenHandler">,
  appOrigin: string,
  dependencies: NavigationDependencies,
): void {
  const apply = (result: Navigation) => {
    if (result.action === "load")
      void dependencies.load(result.url).catch(dependencies.warn);
    if (result.action === "external")
      void dependencies.openExternal(result.url).catch(dependencies.warn);
  };
  contents.on("will-navigate", (event) => {
    const result = navigationTarget(event.url, appOrigin);
    if (result.action !== "allow") {
      event.preventDefault();
      apply(result);
    }
  });
  contents.on("will-redirect", (event) => {
    if (!event.isMainFrame) return;
    const result = navigationTarget(event.url, appOrigin);
    if (result.action !== "allow") {
      event.preventDefault();
      apply(result);
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    apply(navigationTarget(url, appOrigin, true));
    return { action: "deny" };
  });
}
