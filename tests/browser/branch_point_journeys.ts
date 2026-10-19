/**
 * The rendered UI each shared branch-point case shows on the branch copy:
 * usage destinations, saved props, removed rows, retained comparison mode,
 * Changes activation, and crumbs.
 */

import { expect, type Page } from "@playwright/test";

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

type Check = (page: Page) => Promise<void>;

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

const movedConsumers: Check = async (page) => {
  await openEntry(page, "branch/consumers/badge");
  await expectHead(page, "Badge", ["Branch [button]", "Consumers [button]"]);
  await inspectorTab(page, "Usage");
  await expect(page.locator("[data-usage-section='used-by']")).toBeVisible();
  const affected = page.locator("[data-usage-section='affected'] a");
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
    ["default", "/view/branch/consumers/archive/status/default/", false],
    ["Receipt", "/view/branch/consumers/archive/receipt/", false],
  ]);
  await affected.nth(1).click();
  await expectRouted(page, "branch/consumers/archive/status/default");
  // A component variant's heading is its parent's title; crumbs end at folders.
  await expectHead(page, "Status", [
    "Branch [button]",
    "Consumers [button]",
    "Archive [button]",
  ]);
};

/** A removed sibling opens inside the comparison mode its siblings use. */
async function removedSibling(
  page: Page,
  parent: [path: string, title: string],
  primary: string,
  removed: string,
  removedCrumbs: readonly string[],
): Promise<void> {
  const [parentPath, title] = parent;
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      `${title} -> ${parentPath}`,
      `primary -> ${primary} (current)`,
      `secondary · Removed -> ${removed}`,
    ]);
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
    .toEqual([
      `${title} -> ${parentPath}`,
      `primary -> ${primary}`,
      `secondary · Removed -> ${removed} (current)`,
    ]);
  await expectRemovedRow(page, parentPath, removed);
}

/**
 * The moved or renamed parent is its own Changes row, so activating it keeps
 * the parent, also while a search shows only its removed variant.
 */
async function parentActivation(
  page: Page,
  parent: string,
  removed: string,
): Promise<void> {
  // Each activation starts on another route, so each one must navigate.
  await activateRow(page, parent);
  await expectRouted(page, parent);
  await search(page, "secondary");
  await activateRow(page, removed);
  await expectRouted(page, removed);
  await activateRow(page, parent);
  await expectRouted(page, parent);
}

const movedParent: Check = async (page) => {
  const parent = "branch/parent/archive/action";
  const removed = "branch/parent/action/secondary";
  await openEntry(page, `${parent}/primary`);
  await expectHead(page, "Action", [
    "Branch [button]",
    "Parent [button]",
    "Archive [button]",
  ]);
  await removedSibling(page, [parent, "Action"], `${parent}/primary`, removed, [
    "Branch [text]",
    "Parent [text]",
  ]);
  await parentActivation(page, parent, removed);
};

const movedVariant: Check = async (page) => {
  await openEntry(page, "branch/variant/donor/spare");
  await expectHead(page, "Donor", ["Branch [button]", "Variant [button]"]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Donor -> branch/variant/donor",
      "spare -> branch/variant/donor/spare (current)",
    ]);
  // An unmodified container opens its first changed variant.
  await activateRow(page, "branch/variant/receiver");
  await expectRouted(page, "branch/variant/receiver/primary");
  await expectHead(page, "Receiver", ["Branch [button]", "Variant [button]"]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Receiver -> branch/variant/receiver",
      "default -> branch/variant/receiver/default",
      "primary -> branch/variant/receiver/primary (current)",
    ]);
  await compareSideBySide(page);
  await expectSavedProps(page, ...PROPS);
  const nav = await openChanges(page);
  await expect(
    nav.locator(
      '[data-nav-disclosure="variants:branch/variant/receiver"] a[data-entry-id="branch/variant/receiver/primary"]',
    ),
  ).toHaveCount(1);
};

const caseRenames: Check = async (page) => {
  const parent = "branch/case/action";
  const removed = "branch/case/Action/secondary";
  await openEntry(page, `${parent}/primary`);
  await expectHead(page, "Case action", ["Branch [button]", "Case [button]"]);
  await removedSibling(
    page,
    [parent, "Case action"],
    `${parent}/primary`,
    removed,
    ["Branch [text]", "Case [text]"],
  );
  await parentActivation(page, parent, removed);
};

const reusedParent: Check = async (page) => {
  const removed = "branch/reused/action/default";
  await openEntry(page, removed);
  // The former parent has no eligible destination, so its crumb is text.
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
    nav.locator('[data-nav-disclosure="variants:branch/reused/action"]'),
  ).toHaveCount(0);
};

/**
 * The checks of the five branch-copy scenarios, keyed by the case names that
 * the old suite used and the test titles keep.
 */
export const BRANCH_POINT_CHECKS: Readonly<Record<string, Check>> = {
  "moved-consumers": movedConsumers,
  "moved-parent": movedParent,
  "moved-variant": movedVariant,
  "case-renames": caseRenames,
  "reused-parent": reusedParent,
};
