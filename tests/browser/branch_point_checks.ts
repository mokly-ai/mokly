/**
 * The rendered UI each branch-point case shows on Serve, in the branch copy,
 * and in the embedded viewer: affected destinations, saved props, removed
 * rows, kept comparison mode, Changes activation, and crumbs.
 */

import { expect, type Page } from "@playwright/test";

import {
  branchPointCases,
  branchPointPaths as paths,
} from "../helpers/branch_point_sources.js";

import {
  activateRow,
  type BranchPointHost,
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

/** A parent, its primary variant, and its removed sibling. */
interface Family {
  title: string;
  parent: string;
  primary: string;
  removed: string;
}

/**
 * A removed sibling opens inside the comparison mode its siblings use, with
 * the base folder titles as text crumbs and its parent's heading.
 */
async function removedSibling(
  page: Page,
  host: BranchPointHost,
  family: Family,
  removedCrumbs: readonly string[],
): Promise<void> {
  const { title, parent, primary, removed } = family;
  await expect
    .poll(() => variantBar(page))
    .toEqual(bar(title, parent, primary, removed, "primary"));
  await compareSideBySide(page, host);
  await expectSavedProps(page, ...PROPS);
  await selectVariant(page, removed);
  await expectRouted(page, host, removed);
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
 * A parent that keeps its own Changes row opens itself from the unfiltered
 * list, and also while a search shows only its removed sibling; the search
 * keeps the removed sibling's row in its list, and that row opens the
 * sibling with its text crumbs. The helper clears any earlier search first.
 */
async function activation(
  page: Page,
  host: BranchPointHost,
  family: Family,
  removedCrumbs: readonly string[],
): Promise<void> {
  const { title, parent, removed } = family;
  await search(page, host, "");
  await activateRow(page, parent);
  await expectRouted(page, host, parent);
  await search(page, host, "secondary");
  await activateRow(page, removed);
  await expectRouted(page, host, removed);
  await expectHead(page, title, removedCrumbs);
  // Each activation starts on another route, so each one must navigate.
  await activateRow(page, parent);
  await expectRouted(page, host, parent);
}

async function movedConsumers(
  page: Page,
  host: BranchPointHost,
): Promise<void> {
  await openEntry(page, host, "branch/consumers/badge");
  await expectHead(page, "Badge", ["Branch [button]", "Consumers [button]"]);
  await inspectorTab(page, "Usage");
  await expect(page.locator("[data-usage-section='used-by']")).toBeVisible();
  const affected = page.locator("[data-usage-section='affected'] a");
  // A variant consumer is its own destination, titled by the variant. Each
  // link asks for its consumer's comparison; a moved consumer is in Changes
  // as a move with unchanged views, so it opens Current.
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
    ["Status", "/view/branch/consumers/archive/status/", true],
    ["default", `/view/${paths.movedConsumer}/`, true],
    ["Receipt", `/view/${paths.movedScreen}/`, true],
  ]);
  await affected.nth(1).click();
  await expectRouted(page, host, paths.movedConsumer);
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

async function movedParent(page: Page, host: BranchPointHost): Promise<void> {
  await openEntry(page, host, paths.movedChild);
  // The folder above the moved parent has its own page, so its crumb links.
  await expectHead(page, "Action", [
    "Branch [button]",
    "Parent -> /view/branch/parent/",
    "Archive [button]",
  ]);
  const family = {
    title: "Action",
    parent: paths.movedParent,
    primary: paths.movedChild,
    removed: paths.removedChild,
  };
  const removedCrumbs = ["Branch [text]", "Parent [text]"];
  await removedSibling(page, host, family, removedCrumbs);
  // The folder's unchanged own page is a container row: it opens the first
  // changed entry it lists, and under a search the removed sibling.
  await activateRow(page, paths.parentFolder);
  await expectRouted(page, host, paths.movedParent);
  await search(page, host, "secondary");
  await activateRow(page, paths.parentFolder);
  await expectRouted(page, host, paths.removedChild);
  await expectHead(page, "Action", removedCrumbs);
  await activation(page, host, family, removedCrumbs);
}

async function movedVariant(page: Page, host: BranchPointHost): Promise<void> {
  await openEntry(page, host, "branch/variant/donor/spare");
  await expectHead(page, "Donor", ["Branch [button]", "Variant [button]"]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Donor -> branch/variant/donor",
      "spare -> branch/variant/donor/spare (current)",
    ]);
  // The unmodified receiver opens its first changed variant from Changes.
  await activateRow(page, "branch/variant/receiver");
  await expectRouted(page, host, paths.movedVariant);
  await expectHead(page, "Receiver", ["Branch [button]", "Variant [button]"]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Receiver -> branch/variant/receiver",
      "default -> branch/variant/receiver/default",
      `primary -> ${paths.movedVariant} (current)`,
    ]);
  await compareSideBySide(page, host);
  await expectSavedProps(page, ...PROPS);
  const nav = await openChanges(page);
  await expect(
    nav.locator(
      `[data-nav-disclosure="variants:branch/variant/receiver"] a[data-entry-id="${paths.movedVariant}"]`,
    ),
  ).toHaveCount(1);
}

async function caseRenames(page: Page, host: BranchPointHost): Promise<void> {
  await openEntry(page, host, paths.caseVariant);
  await expectHead(page, "Case action", ["Branch [button]", "Case [button]"]);
  const family = {
    title: "Case action",
    parent: paths.caseParent,
    primary: paths.caseVariant,
    removed: paths.caseRemoved,
  };
  const removedCrumbs = ["Branch [text]", "Case [text]"];
  await removedSibling(page, host, family, removedCrumbs);
  await activation(page, host, family, removedCrumbs);
}

async function reusedParent(page: Page, host: BranchPointHost): Promise<void> {
  const removed = paths.reusedRemoved;
  await openEntry(page, host, removed);
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

/** Every case's checks, keyed by its name in the shared case set. */
const CHECKS: Readonly<
  Record<string, (page: Page, host: BranchPointHost) => Promise<void>>
> = {
  "moved-consumers": movedConsumers,
  "moved-parent": movedParent,
  "moved-variant": movedVariant,
  "case-renames": caseRenames,
  "reused-parent": reusedParent,
};

/**
 * Each case of `tests/fixtures/branch_point_cases.json` with its checks and
 * the title that starts its test names. A case without checks, or checks
 * without a case, stops the spec from loading, so the browser runs every
 * shared case.
 */
export const BRANCH_POINT_CHECKS = branchPointCases.map(({ name }) => {
  const check = CHECKS[name];
  if (!check) throw new Error(`No browser checks for the case ${name}`);
  return { title: name.replaceAll("-", " "), check };
});
if (BRANCH_POINT_CHECKS.length !== Object.keys(CHECKS).length)
  throw new Error("Browser checks name a case that the shared set lacks");
