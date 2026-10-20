/** Rendered branch-point facts on Serve, the branch copy, and the embedded viewer. */

import { expect, type Locator, type Page } from "@playwright/test";

import { expectHostPath } from "./entry_hosts.js";
import type { MovedHost } from "./moved_rows.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";

/**
 * How one host runs the branch-point checks. The hosts of the moved cases
 * fit: Serve and the branch copy route by address, the embedded viewer opens
 * an entry by query, and only Serve captures comparisons on demand.
 */
export type BranchPointHost = Pick<MovedHost, "comparisons" | "open" | "path">;

/** The two widths each case renders at. */
export const BRANCH_POINT_WIDTHS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** One crumb as `label -> href`, `label [button]`, or `label [text]`. */
export async function crumbs(page: Page): Promise<string[]> {
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
 * Search the catalogue; Changes keeps only the rows the query matches. A
 * narrow viewer shows a compact control: its button opens the field, and
 * closing it again keeps the query and shows the navigation menu.
 */
export async function search(page: Page, query: string): Promise<void> {
  await openChanges(page);
  const field = page.locator("[data-mokly-search]");
  const compact = page.getByRole("button", { name: "Search catalogue" });
  const opened = !(await field.isVisible()) && (await compact.isVisible());
  if (opened) await compact.click();
  await field.fill(query);
  if (opened) await page.getByRole("button", { name: "Close search" }).click();
}

/** Wait until the head and the host's page path name one entry. */
export async function expectRouted(
  page: Page,
  host: BranchPointHost,
  entry: string,
): Promise<void> {
  await expect(
    page.locator(".mbk-screen-head [data-copy-path]"),
  ).toHaveAttribute("data-copy-path", entry);
  await expectHostPath(page, host, entry);
}

/** Open an entry on `host` and wait for its workspace head. */
export async function openEntry(
  page: Page,
  host: BranchPointHost,
  entry: string,
): Promise<void> {
  await host.open(page, entry);
  await expect(page.locator(".mbk-screen-head h2")).toBeVisible();
}
