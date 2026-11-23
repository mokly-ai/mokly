/**
 * The removed sibling of a branch-point family on each host: a parent, its
 * primary variant, and a variant that the branch removed. The sibling joins
 * its resolved parent's Variants and Changes list, opens in the comparison
 * mode of its siblings, and names its base folders in Inspect's head.
 */

import { expect, type Page } from "@playwright/test";

import {
  activateRow,
  type BranchPointHost,
  compareSideBySide,
  expectHead,
  expectRouted,
  expectSavedProps,
  openChanges,
  search,
  variantBar,
} from "./branch_point_ui.js";
import { modeButton } from "./comparison_ui.js";
import { openPanelTab, revealInPanel } from "./workspace_actions.js";

const PROPS = ['{"label": "Continue"}', '{"label": "Submit"}'] as const;

/** A parent, its primary variant, and its removed sibling. */
export interface Family {
  title: string;
  parent: string;
  primary: string;
  removed: string;
}

/** A removed entry's head: its Path row's crumbs and its base folder titles. */
export interface RemovedHead {
  crumbs: readonly string[];
  folders: string;
}

/**
 * Select one saved variant from Inspect's Variants, keeping the workspace
 * mounted. In the compact layout Inspect stands in the panel's sheet.
 */
async function selectVariant(page: Page, path: string): Promise<void> {
  const row = page.locator(
    `[data-inspect-section="variants"] [data-inspect-variant="${path}"]`,
  );
  await revealInPanel(page, row);
  await row.click();
}

/** A removed sibling listed once, inside its resolved parent's list. */
async function expectRemovedRow(
  page: Page,
  parent: string,
  removed: string,
): Promise<void> {
  const nav = await openChanges(page);
  await expect(
    nav.locator(
      `[data-nav-disclosure="variants:${parent}"] a[data-entry-id="${removed}"]`,
    ),
  ).toHaveCount(1);
  await expect(nav.locator(`a[data-entry-id="${removed}"]`)).toHaveCount(1);
}

/**
 * The parent's own entry, then its variants; removed ones come last. The
 * list checks the variant of the selected frame, which a routed saved
 * variant selects; a removed variant has no frame, so its route checks none.
 */
function bar(family: Family, routed: "primary" | "removed"): string[] {
  const { title, parent, primary, removed } = family;
  return [
    `${title} -> ${parent}`,
    `primary -> ${primary}${routed === "primary" ? " (current)" : ""}`,
    `secondary · Removed -> ${removed}`,
  ];
}

/**
 * A removed sibling opens inside the comparison mode its siblings use, with
 * the base folder titles in its head and its parent's heading.
 */
export async function removedSibling(
  page: Page,
  host: BranchPointHost,
  family: Family,
  head: RemovedHead,
): Promise<void> {
  const { title, parent, removed } = family;
  await expect.poll(() => variantBar(page)).toEqual(bar(family, "primary"));
  await compareSideBySide(page, host);
  await expectSavedProps(page, ...PROPS);
  await selectVariant(page, removed);
  await expectRouted(page, host, removed);
  await openPanelTab(page, "Changes");
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectHead(page, title, head.crumbs, head.folders);
  await expect.poll(() => variantBar(page)).toEqual(bar(family, "removed"));
  await expectRemovedRow(page, parent, removed);
}

/**
 * A parent that keeps its own Changes row opens itself from the unfiltered
 * list, and also while a search shows only its removed sibling; the search
 * keeps the removed sibling's row in its list, and that row opens the
 * sibling with its base folder titles. The helper clears any earlier search
 * first.
 */
export async function activation(
  page: Page,
  host: BranchPointHost,
  family: Family,
  head: RemovedHead,
): Promise<void> {
  const { title, parent, removed } = family;
  await search(page, host, "");
  await activateRow(page, parent);
  await expectRouted(page, host, parent);
  await search(page, host, "secondary");
  await activateRow(page, removed);
  await expectRouted(page, host, removed);
  await expectHead(page, title, head.crumbs, head.folders);
  // Each activation starts on another route, so each one must navigate.
  await activateRow(page, parent);
  await expectRouted(page, host, parent);
}

/** The saved props that every family's primary variant changes. */
export function expectFamilyProps(page: Page): Promise<void> {
  return expectSavedProps(page, ...PROPS);
}
