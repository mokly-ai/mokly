/** Rendered branch-point facts shared by the Serve, export and viewer specs. */

import { expect, type Locator, type Page } from "@playwright/test";

import type { BranchHost, BranchHostKind } from "./branch_hosts.js";

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

/** Switch the comparison band to Side by side and wait for its props. */
export async function compareSideBySide(page: Page): Promise<void> {
  const side = page.locator("[data-diff-mode=side]");
  await side.click();
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

/** Search the catalogue; Changes keeps only the rows the query matches. */
export async function search(page: Page, query: string): Promise<void> {
  await openChanges(page);
  await page.locator("[data-mokly-search]").fill(query);
}

/**
 * Wait until a host shows one entry: its head names the entry's path, and a
 * standalone shell's address is that entry's route. The embedded viewer's
 * host page owns its own address, so only the rendered head applies there.
 */
export async function expectRouted(
  page: Page,
  kind: BranchHostKind,
  entry: string,
): Promise<void> {
  await expect(
    page.locator(".mbk-screen-head [data-copy-path]"),
  ).toHaveAttribute("data-copy-path", entry);
  if (kind !== "viewer")
    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).pathname))
      .toBe(`/view/${entry}/`);
}

/** Record every server error a page meets, for a final assertion. */
export function serverErrors(page: Page): string[] {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 500)
      failures.push(`${response.status()} ${response.url()}`);
  });
  return failures;
}

/** Open an entry and wait for its workspace head. */
export async function openEntry(
  page: Page,
  host: BranchHost,
  entry: string,
): Promise<void> {
  await host.open(page, entry);
  await expect(page.locator(".mbk-screen-head h2")).toBeVisible();
}
