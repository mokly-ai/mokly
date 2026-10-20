/** Rendered branch-point facts on Serve, the branch copy, and the embedded viewer. */

import { expect, type Locator, type Page } from "@playwright/test";

import { expectHostPath, type EntryHost } from "./entry_hosts.js";
import type { MovedHost } from "./moved_rows.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";

/**
 * How one host runs the branch-point checks. The hosts of the moved cases
 * fit: each says how it opens an entry, which page path it shows for that
 * entry, and whether a narrow window shows the compact search control. Only
 * Serve captures comparisons on demand.
 */
export type BranchPointHost = Pick<
  MovedHost,
  "comparisons" | "compactSearch" | "open" | "path"
>;

/**
 * The widest viewer that shows the compact search control in place of the
 * field, in CSS pixels, under the viewer contract.
 */
const COMPACT_SEARCH_WIDTH = 560;

/** The two widths each case renders at. */
export const BRANCH_POINT_WIDTHS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** One crumb as `label -> href`, `label [button]`, or `label [text]`. */
async function crumbs(page: Page): Promise<string[]> {
  return page
    .locator(".mbk-screen-head .mbk-crumbs > span")
    .evaluateAll((spans) =>
      spans.map((span) => {
        const link = span.querySelector("a");
        const button = span.querySelector("button");
        const copy = span.cloneNode(true) as Element;
        copy.querySelector(".sep")?.remove();
        const text = (node: Element) => node.textContent?.trim() ?? "";
        return link
          ? `${text(link)} -> ${link.getAttribute("href")}`
          : button
            ? `${text(button)} [button]`
            : `${text(copy)} [text]`;
      }),
    );
}

/** The variant bar as `label -> path`, with the current one marked. */
export async function variantBar(page: Page): Promise<string[]> {
  return page
    .locator("nav[aria-label='Saved variants'] a")
    .evaluateAll((links) =>
      links.map(
        (link) =>
          `${link.textContent?.trim()} -> ${link.getAttribute("data-workspace-variant")}${
            link.getAttribute("aria-current") ? " (current)" : ""
          }`,
      ),
    );
}

/** The workspace head: its heading and its crumbs, once they settle. */
export async function expectHead(
  page: Page,
  heading: string,
  expected: readonly string[],
): Promise<void> {
  await expect(page.locator(".mbk-screen-head h2")).toHaveText(heading);
  await expect.poll(() => crumbs(page)).toEqual(expected);
}

/** Select one inspector tab by its accessible name. */
export async function inspectorTab(page: Page, name: string): Promise<void> {
  const tab = page.getByRole("tab", { name, exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/**
 * Switch the comparison band to Side by side. On Serve the click waits for
 * the comparison that it requests, through its redirect.
 */
export async function compareSideBySide(
  page: Page,
  host: BranchPointHost,
): Promise<void> {
  const side = page.locator("[data-diff-mode=side]");
  if (host.comparisons === "on demand")
    await awaitSelectedComparison(page, () => side.click());
  else await side.click();
  await expect(side).toHaveAttribute("aria-pressed", "true");
}

/** The saved props block of the Details panel: its Before and Current text. */
export async function expectSavedProps(
  page: Page,
  before: string,
  after: string,
): Promise<void> {
  await inspectorTab(page, "Details");
  const evidence = page.locator("[data-workspace-evidence]");
  await expect(
    evidence.getByRole("heading", { name: "Saved props changed" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      evidence
        .locator("h3:has-text('Saved props changed') ~ pre")
        .allTextContents(),
    )
    .toEqual([before, after]);
}

/**
 * Show the navigation under the Changes filter, opening the drawer at a
 * narrow width, and return it.
 */
export async function openChanges(page: Page): Promise<Locator> {
  const nav = page.locator("nav.mbk-nav");
  const menu = page.locator("[data-mokly-menu]");
  if (!(await nav.isVisible()) && (await menu.isVisible())) await menu.click();
  await expect(nav).toBeVisible();
  const filter = nav.locator("[data-filter=changed]");
  if ((await filter.getAttribute("aria-pressed")) !== "true")
    await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  return nav;
}

/** Activate one navigation row under the Changes filter. */
export async function activateRow(page: Page, entryId: string): Promise<void> {
  const nav = await openChanges(page);
  await nav.locator(`a[data-nav-row][data-entry-id="${entryId}"]`).click();
}

/**
 * Expect the search control that `host` claims at the window width: the
 * compact control when a narrow window shows it, otherwise the field.
 * Return whether the control is compact.
 */
async function expectSearchControl(
  page: Page,
  host: EntryHost,
): Promise<boolean> {
  const compact =
    host.compactSearch && page.viewportSize()!.width <= COMPACT_SEARCH_WIDTH;
  const field = page.locator("[data-mokly-search]");
  const control = page.getByRole("button", { name: "Search catalogue" });
  await expect(compact ? control : field).toBeVisible();
  await expect(compact ? field : control).toBeHidden();
  return compact;
}

/**
 * Search the catalogue; Changes keeps only the rows the query matches. The
 * compact control opens the field, and closing it again keeps the query and
 * shows the navigation menu.
 */
export async function search(
  page: Page,
  host: EntryHost,
  query: string,
): Promise<void> {
  await openChanges(page);
  const compact = await expectSearchControl(page, host);
  if (compact)
    await page.getByRole("button", { name: "Search catalogue" }).click();
  await page.locator("[data-mokly-search]").fill(query);
  if (compact) await page.getByRole("button", { name: "Close search" }).click();
}

/** Wait until the head and the host's page path name one entry. */
export async function expectRouted(
  page: Page,
  host: EntryHost,
  entry: string,
): Promise<void> {
  await expect(
    page.locator(".mbk-screen-head [data-copy-path]"),
  ).toHaveAttribute("data-copy-path", entry);
  await expectHostPath(page, host, entry);
}

/**
 * Open an entry on `host`, wait for its workspace head, and expect the
 * search control that the host claims at the window width.
 */
export async function openEntry(
  page: Page,
  host: EntryHost,
  entry: string,
): Promise<void> {
  await host.open(page, entry);
  await expect(page.locator(".mbk-screen-head h2")).toBeVisible();
  await expectSearchControl(page, host);
}
