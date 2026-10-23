/**
 * Routes, locators, and request records that the client-shell route and
 * history specs share over Serve of the example.
 */

import type { APIRequestContext, Page, Route } from "@playwright/test";

export const WELCOME = "example/screens/welcome";
export const DETAILS = "example/screens/details";
export const MEMBERS = "example/team/members";

/** Entry titles from the served index, so the specs never copy them. */
export async function titles(request: APIRequestContext) {
  const index = (await (
    await request.get("/mokly-viewer/index.json")
  ).json()) as { screens: { path: string; title: string }[] };
  return new Map(index.screens.map((entry) => [entry.path, entry.title]));
}

export const heading = (page: Page) => page.locator("#mb-main h2");
export const navLink = (page: Page, path: string) =>
  page.locator(`a[data-entry-id="${path}"][data-nav-row]`);
export const route = (path: string) => `/view/${path}/`;

/** Open a specs folder that starts closed, so its rows can be clicked. */
export async function openFolder(page: Page, folder: string) {
  const details = page.locator(
    `[data-nav-section="specs"] details[data-nav-folder="folder:${folder}"]`,
  );
  if (
    !(await details.evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await details.locator(":scope > summary").click();
}

/** Paths of the index and detail reads that a page makes from now on. */
export function readsOf(page: Page): string[] {
  const reads: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (/^\/mokly-viewer\/(?:index\.json|entries\/)/.test(pathname))
      reads.push(pathname);
  });
  return reads;
}

/** The number of page loads from now on; in-shell navigation makes none. */
export function loadsOf(page: Page): { count: number } {
  const loads = { count: 0 };
  page.on("load", () => {
    loads.count += 1;
  });
  return loads;
}

/** Hold every read of a path until the spec releases it. */
export async function holdReads(page: Page, path: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${path}`, async (held) => {
    await released;
    await held.continue().catch(() => undefined);
  });
  return release;
}

/** Answer a read with the served JSON after one change. */
export const rewritten =
  (change: (body: Record<string, unknown>) => Record<string, unknown>) =>
  async (held: Route) => {
    const response = await held.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await held.fulfill({ response, json: change(body) });
  };
