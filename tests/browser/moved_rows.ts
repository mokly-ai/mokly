/** Shared locators and checks for the moved-entry viewer cases. */

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { movedFixturePaths } from "../helpers/moved_fixture_sources.js";

/** How one host runs the moved cases. */
export interface MovedHost {
  /** Open one entry. */
  open(page: Page, entry: string): Promise<unknown>;
  /** Serve captures comparisons on demand; a copy publishes them. */
  comparisons: "on demand" | "published";
  /** The page address follows the selected entry as `/view/{path}/`. */
  routes: boolean;
  /** The window widths of the Moved-row case. */
  widths: readonly number[];
}

const openRoute = (page: Page, entry: string) => page.goto(`/view/${entry}/`);

/** The private Serve fixture. */
export const serveMovedHost: MovedHost = {
  open: openRoute,
  comparisons: "on demand",
  routes: true,
  widths: [390, 1280],
};

/** The branch copy. */
export const copyMovedHost: MovedHost = {
  open: openRoute,
  comparisons: "published",
  routes: true,
  widths: [390, 1280],
};

/**
 * An embedded viewer over the branch copy through one frame adapter. Its
 * host page opens an entry by query and keeps one fixed width.
 */
export function embeddedMovedHost(adapter: "cross" | "same-origin"): MovedHost {
  return {
    open: (page, entry) =>
      page.goto(`/viewer.html?adapter=${adapter}&entry=${entry}`),
    comparisons: "published",
    routes: false,
    widths: [1280],
  };
}

export const INVOICE = movedFixturePaths.movedInvoice;
export const ACTION = movedFixturePaths.movedAction;
/** The base-side folder of the moved shapes, which keeps only removed rows. */
export const PREVIOUS = "branch/moves/previous";

/** The catalogue row for one entry. */
export function row(page: Page, entry: string) {
  return page.locator(`nav.mbk-nav a[data-nav-row][data-entry-id="${entry}"]`);
}

/** The trailing changed dot the stylesheet draws, or `none` when unmarked. */
export function dot(page: Page, entry: string): Promise<string> {
  return row(page, entry).evaluate(
    (element) => getComputedStyle(element, "::after").content,
  );
}

/** Select the Details panel, which some entries open with already. */
export async function showDetails(page: Page): Promise<void> {
  const details = page.getByRole("tab", { name: "Details", exact: true });
  if ((await details.getAttribute("aria-selected")) !== "true")
    await details.click();
  await expect(details).toHaveAttribute("aria-selected", "true");
}

/** Open the narrow layout's drawer when the catalogue is behind it. */
export async function showCatalogue(page: Page): Promise<void> {
  // Wait for the mounted shell: either the menu or the catalogue shows.
  await expect(
    page.locator("[data-mokly-menu]:visible, nav.mbk-nav:visible").first(),
  ).toBeVisible();
  const menu = page.locator("[data-mokly-menu]");
  if (await menu.isVisible()) await menu.click();
  await expect(page.locator('button[data-filter="all"]')).toBeVisible();
}

/** Expect each row's label and whether All draws its changed mark. */
export async function expectMarks(
  page: Page,
  rows: readonly (readonly [entry: string, label: string, marked: boolean])[],
): Promise<void> {
  for (const [entry, label, marked] of rows) {
    await expect(row(page, entry)).toHaveAccessibleName(
      marked ? `${label} Changed` : label,
    );
    if (marked) expect(await dot(page, entry)).not.toBe("none");
    else expect(await dot(page, entry)).toBe("none");
  }
}

interface IndexRecord {
  path: string;
  title: string;
  previousPath?: string;
  changes?: { included?: boolean };
}

/** Every paired entry with its title, and the Changes count, from the index. */
export async function movedIndex(
  request: APIRequestContext,
  baseURL: string | undefined,
): Promise<{ count: number; moved: [path: string, title: string][] }> {
  const response = await request.get(`${baseURL}/mokly-viewer/index.json`);
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as Record<string, unknown>;
  const current = [
    "screens",
    "components",
    "pages",
    "documents",
    "useCases",
  ].flatMap((key) => (index[key] as IndexRecord[] | undefined) ?? []);
  return {
    count:
      current.filter((entry) => entry.changes?.included).length +
      (index["removedEntries"] as unknown[]).length,
    moved: current
      .filter((entry) => entry.previousPath !== undefined)
      .map((entry) => [entry.path, entry.title]),
  };
}
