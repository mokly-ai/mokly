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

import { openPanelTab } from "./workspace_actions.js";

/** The index fields the comparison UI specs compare with the shell. */
export interface ComparisonIndexEntry {
  path: string;
  title: string;
  variantOf?: string;
  previousPath?: string;
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
  // A snapshot id is a SHA-256 digest in lowercase hexadecimal.
  expect(record.snapshotId, `${entryPath} snapshot id`).toMatch(
    /^[a-f0-9]{64}$/u,
  );
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

/** The value of `data-compare-mode` that each diff mode draws on the frames. */
const MODES = {
  "Side by side": "side",
  Overlay: "overlay",
  Difference: "difference",
  Swipe: "swipe",
} as const;

/** A diff mode, by its name on the band. */
export type DiffMode = keyof typeof MODES;

/** A comparison mode, by its name on the band: Current or a diff mode. */
export type ModeName = "Current" | DiffMode;

/** The comparison mode buttons by their visible names. */
export function modeButton(page: Page, name: ModeName): Locator {
  return page
    .getByRole("group", { name: "Comparison mode" })
    .getByRole("button", { name, exact: true });
}

/**
 * Choose a comparison mode: open the right panel's Changes tab, which holds
 * the band, press the mode, and wait until the band marks it pressed.
 */
export async function chooseMode(page: Page, name: ModeName): Promise<void> {
  await openPanelTab(page, "Changes");
  await modeButton(page, name).click();
  await expect(modeButton(page, name)).toHaveAttribute("aria-pressed", "true");
}

/** Every version's frame that the canvas compares on its frames. */
export function comparisonFrames(page: Page): Locator {
  return page.locator("[data-mokly-stage] iframe[data-mokly-comparison-frame]");
}

/**
 * The compare on the canvas, which names its entry in `data-diff-screen` and
 * is busy while its comparison or its documents load.
 */
export function compareStage(page: Page): Locator {
  return page.locator("[data-diff-screen]");
}

/**
 * The state that the canvas holds in place of its frames, `Loading
 * comparison…` or the failure with Try again. It exists only while the
 * comparison loads or failed, and it never holds a pane.
 */
export function compareState(page: Page): Locator {
  return page.locator("[data-diff-stage]");
}

/**
 * Choose a diff mode and wait for its frames to hold the loaded versions:
 * `frames` pane documents in all, two for each compared frame of Overlay,
 * Difference or Swipe, such as eight for the four frames of a wide canvas,
 * and two for the compared frame of Side by side.
 */
export async function showMode(
  page: Page,
  name: DiffMode,
  frames: number,
): Promise<void> {
  await chooseMode(page, name);
  await expect(
    page.locator(`[data-mokly-stage] [data-compare-mode="${MODES[name]}"]`),
  ).not.toHaveCount(0);
  await expect(comparisonFrames(page)).toHaveCount(frames);
}

/**
 * Expect the routed entry to offer no compare mode: its Changes tab, when it
 * has one, shows no band, so the check never passes only because Inspect is
 * the selected tab. Call it once the entry's detail settled, such as after
 * `awaitRoutedDetail`.
 */
export async function expectNoCompareModes(page: Page): Promise<void> {
  if (await page.getByRole("tab", { name: "Changes", exact: true }).count())
    await openPanelTab(page, "Changes");
  await expect(
    page.getByRole("group", { name: "Comparison mode" }),
  ).toBeHidden();
}

/**
 * The outcome line of each compared frame, which the band lists in a diff
 * mode, such as `Desktop · Light · Screen changed`, in the frames' order.
 */
export function outcomeLines(scope: Page | Locator): Locator {
  return scope
    .getByRole("list", { name: "Compared frames" })
    .getByRole("listitem");
}

/**
 * Wait until the shell shows `entryPath` and has applied its entry detail.
 * The head names the routed entry in the same render that starts the detail
 * load, and the stage and the Usage panel show that load until it settles.
 * The detail can still make an entry comparison-eligible, so every check that
 * the comparison band is absent waits for this first.
 */
export async function awaitRoutedDetail(
  scope: Page | Locator,
  entryPath: string,
): Promise<void> {
  await expect(
    scope.locator(".mbk-screen-head [data-copy-path]"),
  ).toHaveAttribute("data-copy-path", entryPath);
  await expect(
    scope.locator('[data-mokly-stage][aria-busy="true"]'),
  ).toHaveCount(0);
  await expect(
    scope.locator('[data-inspector-panel="usage"] p[role="status"]'),
  ).toHaveCount(0);
}
