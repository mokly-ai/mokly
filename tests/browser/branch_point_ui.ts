/** Rendered branch-point facts on Serve, the branch copy, and the embedded viewer. */

import { expect, type Locator, type Page } from "@playwright/test";

import { chooseMode } from "./comparison_ui.js";
import { expectHostPath, type EntryHost } from "./entry_hosts.js";
import type { MovedHost } from "./moved_rows.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";
import { openCatalogueSheet, revealInPanel } from "./workspace_actions.js";

/**
 * How one host runs the branch-point checks. The hosts of the moved cases
 * fit: each says how it opens an entry, which page path it shows for that
 * entry, whether a narrow window shows the compact search control, and how
 * it opens an Affected link. Only Serve captures comparisons on demand.
 */
export type BranchPointHost = Pick<
  MovedHost,
  "affectedLinks" | "comparisons" | "compactSearch" | "open" | "path"
>;

/**
 * The widest viewer that shows the compact search control in place of the
 * field, in CSS pixels, under the viewer contract.
 */
const COMPACT_SEARCH_WIDTH = 560;

/** The window sizes that a branch-point case can render at, by name. */
export const BRANCH_POINT_WIDTHS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

/** Inspect's head, which names the routed entry and holds its Details rows. */
const HEAD = '[data-inspect-section="details"]';

/**
 * Each segment of the Path row of Inspect's head as `segment -> href`,
 * `segment [button]`, or `segment [text]`: a folder's breadcrumb links to
 * the folder's own page or reveals the folder, and the rest is text.
 */
async function pathCrumbs(page: Page): Promise<string[]> {
  return page.locator("[data-inspect-path] code").evaluate((code) =>
    [...code.children]
      .filter((part) => part.tagName === "SPAN")
      .map((part) => {
        const link = part.querySelector("a");
        const button = part.querySelector("button");
        const text = (part.textContent ?? "").trim().replace(/\/$/u, "");
        return link
          ? `${text} -> ${link.getAttribute("href")}`
          : button
            ? `${text} [button]`
            : `${text} [text]`;
      }),
  );
}

/** The Location row of a removed entry's head, which names its base folders. */
function locationRow(page: Page): Locator {
  return page.locator(`${HEAD} .mbk-meta-row`, {
    has: page.locator(".mbk-meta-k", { hasText: /^Location$/u }),
  });
}

/**
 * Inspect's Variants list as `label -> path`: the checked row marked
 * current, and a row that opens a previous version marked removed.
 */
export async function variantBar(page: Page): Promise<string[]> {
  return page
    .locator('[data-inspect-section="variants"] [data-inspect-variant]')
    .evaluateAll((rows) =>
      rows.map((row) => {
        const href = row.getAttribute("href");
        const removed =
          href !== null &&
          new URL(href, location.href).searchParams.has("snapshot");
        const checked =
          row.getAttribute("aria-current") === "page" ||
          row.getAttribute("aria-pressed") === "true";
        return `${row.textContent?.trim()}${removed ? " · Removed" : ""} -> ${row.getAttribute("data-inspect-variant")}${checked ? " (current)" : ""}`;
      }),
    );
}

/**
 * Inspect's head, once it settles: its title, the segments of its Path row,
 * and for a removed entry the base folder titles of its Location row. In the
 * compact layout the head stands in the panel's sheet, which this opens.
 */
export async function expectHead(
  page: Page,
  heading: string,
  crumbs: readonly string[],
  folders?: string,
): Promise<void> {
  const title = page.locator(`${HEAD} h2`);
  await revealInPanel(page, title);
  await expect(title).toHaveText(heading);
  await expect.poll(() => pathCrumbs(page)).toEqual(crumbs);
  if (folders === undefined) await expect(locationRow(page)).toHaveCount(0);
  else await expect(locationRow(page)).toHaveText(`Location${folders}`);
}

/**
 * Switch the comparison band of the Changes tab to Side by side. On Serve
 * the click waits for the comparison that it requests, through its
 * redirect. In the compact layout the band stands in the panel's sheet.
 */
export async function compareSideBySide(
  page: Page,
  host: BranchPointHost,
): Promise<void> {
  if (host.comparisons === "on demand")
    await awaitSelectedComparison(page, () => chooseMode(page, "Side by side"));
  else await chooseMode(page, "Side by side");
}

/**
 * The saved props block of the comparison details, which the Changes tab
 * holds: its Before and Current text.
 */
export async function expectSavedProps(
  page: Page,
  before: string,
  after: string,
): Promise<void> {
  const evidence = page.locator("[data-workspace-evidence]");
  await revealInPanel(page, evidence);
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
  // Below the layout breakpoint the dock's Catalogue opens the catalogue's
  // sheet, once an open panel sheet has closed.
  await expect(nav).toBeAttached();
  if (!(await nav.isVisible())) await openCatalogueSheet(page);
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

/** Wait until Inspect's Path row and the host's page path name one entry. */
export async function expectRouted(
  page: Page,
  host: EntryHost,
  entry: string,
): Promise<void> {
  await expect(page.locator("[data-inspect-path] code")).toHaveText(entry);
  await expectHostPath(page, host, entry);
}

/**
 * Open an entry on `host`, wait until a visible title names it, and expect
 * the search control that the host claims at the window width.
 */
export async function openEntry(
  page: Page,
  host: EntryHost,
  entry: string,
): Promise<void> {
  await host.open(page, entry);
  // Inspect's head names the entry, or in the compact layout, whose head
  // stands in the panel's closed sheet, the entry bar does.
  await expect(
    page
      .locator(`${HEAD} h2, [data-entry-bar] .mbk-canvas-title-tag`)
      .filter({ visible: true }),
  ).toHaveCount(1);
  await expectSearchControl(page, host);
}
