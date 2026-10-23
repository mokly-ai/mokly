/**
 * How a host opens an entry, which page path it shows while it shows that
 * entry, and which search control a narrow window shows. Shared case sets
 * take a host, so each host checks its own address after every navigation.
 */

import { expect, type Page } from "@playwright/test";

/** One host of the shared viewer cases. */
export interface EntryHost {
  /** Open one entry. */
  open(page: Page, entry: string): Promise<unknown>;
  /** The page path while the host shows `entry`. */
  path(entry: string): string;
  /**
   * A narrow window shows the viewer's compact search control in place of
   * its search field. The standalone shell keeps the field at every width.
   */
  compactSearch: boolean;
}

/** A standalone shell or Serve: each entry opens at its own route. */
export const routedHost: EntryHost = {
  open: (page, entry) => page.goto(`/view/${entry}/`),
  path: (entry) => `/view/${entry}/`,
  compactSearch: false,
};

/**
 * An embedded viewer through one frame adapter. Its host page opens an
 * entry by query and keeps its own address, so a link that leaves the
 * viewer for the standalone shell changes the path. The page gives the
 * viewer the window width, so a narrow window shows a narrow viewer.
 */
export function embeddedHost(adapter: "cross" | "same-origin"): EntryHost {
  return {
    open: (page, entry) =>
      page.goto(`/viewer.html?adapter=${adapter}&responsive=1&entry=${entry}`),
    path: () => "/viewer.html",
    compactSearch: true,
  };
}

/** Wait until the page path is the one that `host` shows for `entry`. */
export async function expectHostPath(
  page: Page,
  host: EntryHost,
  entry: string,
): Promise<void> {
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).pathname))
    .toBe(host.path(entry));
}
