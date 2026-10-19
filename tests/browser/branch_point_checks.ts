/**
 * The rendered UI each branch-point case shows in the copied branch-point
 * output: affected destinations, saved props, removed rows, kept comparison
 * mode, Changes activation, and crumbs.
 */

import { expect, type Page } from "@playwright/test";

import { branchPointPaths as paths } from "../helpers/branch_point_sources.js";

import {
  activateRow,
  compareSideBySide,
  expectHead,
  expectRouted,
  expectSavedProps,
  inspectorTab,
  openChanges,
  openEntry,
  search,
  variantBar,
} from "./branch_point_ui.js";

const PROPS = ['{"label": "Continue"}', '{"label": "Submit"}'] as const;

/** Select one saved variant from the bar, keeping the workspace mounted. */
async function selectVariant(page: Page, path: string): Promise<void> {
  await page
    .locator(
      `nav[aria-label='Saved variants'] a[data-workspace-variant="${path}"]`,
    )
    .click();
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

/** The parent's own entry, then its variants; removed ones come last. */
function bar(
  title: string,
  parent: string,
  primary: string,
  removed: string,
  current: "primary" | "removed",
): string[] {
  return [
    `${title} -> ${parent}`,
    `primary -> ${primary}${current === "primary" ? " (current)" : ""}`,
    `secondary · Removed -> ${removed}${current === "removed" ? " (current)" : ""}`,
  ];
}

/**
 * A removed sibling opens inside the comparison mode its siblings use, with
 * the base folder titles as text crumbs and its parent's heading.
 */
async function removedSibling(
  page: Page,
  family: { title: string; parent: string; primary: string; removed: string },
  removedCrumbs: readonly string[],
): Promise<void> {
  const { title, parent, primary, removed } = family;
  await expect
    .poll(() => variantBar(page))
    .toEqual(bar(title, parent, primary, removed, "primary"));
  await compareSideBySide(page);
  await expectSavedProps(page, ...PROPS);
  await selectVariant(page, removed);
  await expectRouted(page, removed);
  await expect(page.locator("[data-diff-mode=side]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectHead(page, title, removedCrumbs);
  await expect
    .poll(() => variantBar(page))
    .toEqual(bar(title, parent, primary, removed, "removed"));
  await expectRemovedRow(page, parent, removed);
}

/**
 * A parent that keeps its own Changes row opens itself; a search keeps the
 * removed sibling's row in its list, and that row opens the sibling.
 */
async function activation(
  page: Page,
  parent: string,
  removed: string,
): Promise<void> {
  await activateRow(page, parent);
  await expectRouted(page, parent);
  await search(page, "secondary");
  await activateRow(page, removed);
  await expectRouted(page, removed);
}

async function movedConsumers(page: Page): Promise<void> {
  await openEntry(page, "branch/consumers/badge");
  await expectHead(page, "Badge", ["Branch [button]", "Consumers [button]"]);
  await inspectorTab(page, "Usage");
  await expect(page.locator("[data-usage-section='used-by']")).toBeVisible();
  const affected = page.locator("[data-usage-section='affected'] a");
  // A variant consumer is its own destination, titled by the variant.
  await expect(affected).toHaveCount(3);
  expect(
    await affected.evaluateAll((links) =>
      links.map((link) => {
        const url = new URL(link.getAttribute("href")!, location.href);
        return [
          link.textContent,
          url.pathname,
          url.searchParams.has("comparison"),
        ];
      }),
    ),
  ).toEqual([
    ["Status", "/view/branch/consumers/archive/status/", false],
    ["default", `/view/${paths.movedConsumer}/`, false],
    ["Receipt", `/view/${paths.movedScreen}/`, false],
  ]);
  await affected.nth(1).click();
  await expectRouted(page, paths.movedConsumer);
  await expectHead(page, "Status", [
    "Branch [button]",
    "Consumers [button]",
    "Archive [button]",
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Status -> branch/consumers/archive/status",
      `default -> ${paths.movedConsumer} (current)`,
    ]);
}

async function movedParent(page: Page): Promise<void> {
  await openEntry(page, paths.movedChild);
  await expectHead(page, "Action", [
    "Branch [button]",
    "Parent [button]",
    "Archive [button]",
  ]);
  const family = {
    title: "Action",
    parent: paths.movedParent,
    primary: paths.movedChild,
    removed: paths.removedChild,
  };
  const removedCrumbs = ["Branch [text]", "Parent [text]"];
  await removedSibling(page, family, removedCrumbs);
  await activation(page, paths.movedParent, paths.removedChild);
  await expectHead(page, "Action", removedCrumbs);
}

async function movedVariant(page: Page): Promise<void> {
  await openEntry(page, "branch/variant/donor/spare");
  await expectHead(page, "Donor", ["Branch [button]", "Variant [button]"]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Donor -> branch/variant/donor",
      "spare -> branch/variant/donor/spare (current)",
    ]);
  // The unmodified receiver opens its first changed variant from Changes.
  await activateRow(page, "branch/variant/receiver");
  await expectRouted(page, paths.movedVariant);
  await expectHead(page, "Receiver", ["Branch [button]", "Variant [button]"]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Receiver -> branch/variant/receiver",
      "default -> branch/variant/receiver/default",
      `primary -> ${paths.movedVariant} (current)`,
    ]);
  await compareSideBySide(page);
  await expectSavedProps(page, ...PROPS);
  const nav = await openChanges(page);
  await expect(
    nav.locator(
      `[data-nav-disclosure="variants:branch/variant/receiver"] a[data-entry-id="${paths.movedVariant}"]`,
    ),
  ).toHaveCount(1);
}

async function caseRenames(page: Page): Promise<void> {
  await openEntry(page, paths.caseVariant);
  await expectHead(page, "Case action", ["Branch [button]", "Case [button]"]);
  const family = {
    title: "Case action",
    parent: paths.caseParent,
    primary: paths.caseVariant,
    removed: paths.caseRemoved,
  };
  await removedSibling(page, family, ["Branch [text]", "Case [text]"]);
  await activation(page, paths.caseParent, paths.caseRemoved);
}

async function reusedParent(page: Page): Promise<void> {
  const removed = paths.reusedRemoved;
  await openEntry(page, removed);
  await expectHead(page, "default", [
    "Branch [text]",
    "Reused [text]",
    "Former action [text]",
  ]);
  const nav = await openChanges(page);
  await expect(nav.locator(`a[data-entry-id="${removed}"]`)).toHaveCount(1);
  await expect(
    nav.locator(`[data-nav-variants] a[data-entry-id="${removed}"]`),
  ).toHaveCount(0);
  await expect(
    nav.locator(`[data-nav-disclosure="variants:${paths.reusedParent}"]`),
  ).toHaveCount(0);
}

/** Every case's checks, keyed by the shared case name. */
export const BRANCH_POINT_CHECKS = {
  "moved consumers": movedConsumers,
  "moved parent": movedParent,
  "moved variant": movedVariant,
  "case renames": caseRenames,
  "reused parent": reusedParent,
} as const;
