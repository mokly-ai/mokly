/**
 * Shared actions for the comparison UI specs on the copied comparison output.
 * Every read targets the immutable copy; nothing here mocks a read model.
 */

import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

/** The index fields the comparison UI specs compare with the shell. */
export interface ComparisonIndexEntry {
  path: string;
  title: string;
  variantOf?: string;
  changes?: { included: boolean; kind: string; status: string };
}

export interface ComparisonIndex {
  changesStatus: string;
  comparisonUrl: string;
  screens: ComparisonIndexEntry[];
  components: ComparisonIndexEntry[];
  pages?: ComparisonIndexEntry[];
  documents?: ComparisonIndexEntry[];
  removedEntries: {
    entry: ComparisonIndexEntry & { kind: string };
    snapshotId: string;
  }[];
}

/** Read the copied output's index through the same host as the shell. */
export async function comparisonIndex(
  request: APIRequestContext,
  baseURL: string | undefined,
): Promise<ComparisonIndex> {
  const response = await request.get(`${baseURL}/mokly-viewer/index.json`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as ComparisonIndex;
}

/** Every current path the index includes in Changes, then every removed one. */
export function changesPaths(index: ComparisonIndex): string[] {
  const current = [
    ...index.screens,
    ...index.components,
    ...(index.pages ?? []),
    ...(index.documents ?? []),
  ]
    .filter((entry) => entry.changes?.included)
    .map((entry) => entry.path);
  return [...current, ...index.removedEntries.map(({ entry }) => entry.path)];
}

/** The historical snapshot id of one removed entry. */
export function snapshotOf(index: ComparisonIndex, entryPath: string): string {
  const record = index.removedEntries.find(
    ({ entry }) => entry.path === entryPath,
  );
  if (!record) throw new Error(`${entryPath} is not a removed entry`);
  return record.snapshotId;
}

/** The catalogue row of one entry. */
export function navRow(page: Page, entryPath: string): Locator {
  return page.locator(
    `nav.mbk-nav a[data-nav-row][data-route="${entryPath}/index.html"]`,
  );
}

/** The trailing changed dot the stylesheet draws, or `none` when unmarked. */
export function changedDot(page: Page, entryPath: string) {
  return navRow(page, entryPath).evaluate((row) => {
    const style = getComputedStyle(row, "::after");
    return {
      color: style.backgroundColor,
      content: style.content,
      radius: style.borderTopLeftRadius,
      width: style.width,
    };
  });
}

/** How the row's accessible change wording resolves for assistive tech. */
export function changedText(page: Page, entryPath: string) {
  return navRow(page, entryPath)
    .locator(".mbk-nav-changed-text")
    .evaluate((mark) => getComputedStyle(mark).display);
}

/** One authored folder group of the catalogue navigation. */
export function navFolder(page: Page, folderPath: string): Locator {
  return page.locator(
    `nav.mbk-nav details[data-nav-folder="folder:${folderPath}"]`,
  );
}

/** Switch the catalogue filter and wait until the shell applied it. */
export async function chooseFilter(
  page: Page,
  value: "all" | "changed",
): Promise<void> {
  const button = page.locator(`button[data-filter="${value}"]`);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

/** The comparison mode buttons by their visible names. */
export function modeButton(
  page: Page,
  name: "Current" | "Side by side" | "Overlay" | "Difference",
): Locator {
  return page
    .getByRole("group", { name: "Comparison mode" })
    .getByRole("button", { name, exact: true });
}

const MODES = {
  "Side by side": "side",
  Overlay: "overlay",
  Difference: "difference",
} as const;

/** Select a diff mode and wait for its panes to hold the loaded versions. */
export async function showMode(
  page: Page,
  name: keyof typeof MODES,
  frames = 2,
): Promise<void> {
  await modeButton(page, name).click();
  await expect(modeButton(page, name)).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(`[data-diff-stage] [data-compare-mode="${MODES[name]}"]`),
  ).not.toHaveCount(0);
  await expect(
    page.locator("[data-diff-stage] iframe[data-mokly-comparison-frame]"),
  ).toHaveCount(frames);
}
