/**
 * The rendered UI each branch-point case shows on the host that runs it:
 * affected destinations, saved props, removed rows, kept comparison mode,
 * Changes activation, and the breadcrumbs of Inspect's Path row. The branch
 * copy runs every case; Serve and the embedded viewer run some of them.
 */

import { expect, type Page } from "@playwright/test";

import {
  branchPointCases,
  branchPointPaths as paths,
} from "../helpers/branch_point_sources.js";

import {
  affectedDestinations,
  movedConsumers,
} from "./branch_point_affected.js";
import {
  activation,
  expectFamilyProps,
  removedSibling,
} from "./branch_point_siblings.js";
import {
  activateRow,
  type BranchPointHost,
  compareSideBySide,
  expectHead,
  expectRouted,
  openChanges,
  openEntry,
  search,
  variantBar,
} from "./branch_point_ui.js";

async function movedParent(page: Page, host: BranchPointHost): Promise<void> {
  await openEntry(page, host, paths.movedChild);
  // The folder above the moved parent has its own page, so its crumb links.
  await expectHead(page, "Action", [
    "branch [button]",
    "parent -> /view/branch/parent/",
    "archive [button]",
    "action [text]",
    "primary [text]",
  ]);
  const family = {
    title: "Action",
    parent: paths.movedParent,
    primary: paths.movedChild,
    removed: paths.removedChild,
  };
  const head = {
    crumbs: [
      "branch [text]",
      "parent [text]",
      "action [text]",
      "secondary [text]",
    ],
    folders: "Branch › Parent",
  };
  await removedSibling(page, host, family, head);
  // The folder's unchanged own page is a container row: it opens the first
  // changed entry it lists, and under a search the removed sibling.
  await activateRow(page, paths.parentFolder);
  await expectRouted(page, host, paths.movedParent);
  await search(page, host, "secondary");
  await activateRow(page, paths.parentFolder);
  await expectRouted(page, host, paths.removedChild);
  await expectHead(page, "Action", head.crumbs, head.folders);
  await activation(page, host, family, head);
}

async function movedVariant(page: Page, host: BranchPointHost): Promise<void> {
  await openEntry(page, host, "branch/variant/donor/spare");
  await expectHead(page, "Donor", [
    "branch [button]",
    "variant [button]",
    "donor [text]",
    "spare [text]",
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Donor -> branch/variant/donor",
      "spare -> branch/variant/donor/spare (current)",
    ]);
  // The unmodified receiver opens its first changed variant from Changes.
  await activateRow(page, "branch/variant/receiver");
  await expectRouted(page, host, paths.movedVariant);
  await expectHead(page, "Receiver", [
    "branch [button]",
    "variant [button]",
    "receiver [text]",
    "primary [text]",
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Receiver -> branch/variant/receiver",
      "default -> branch/variant/receiver/default",
      `primary -> ${paths.movedVariant} (current)`,
    ]);
  await compareSideBySide(page, host);
  await expectFamilyProps(page);
  const nav = await openChanges(page);
  await expect(
    nav.locator(
      `[data-nav-disclosure="variants:branch/variant/receiver"] a[data-entry-id="${paths.movedVariant}"]`,
    ),
  ).toHaveCount(1);
}

async function caseRenames(page: Page, host: BranchPointHost): Promise<void> {
  await openEntry(page, host, paths.caseVariant);
  await expectHead(page, "Case action", [
    "branch [button]",
    "case [button]",
    "action [text]",
    "primary [text]",
  ]);
  const family = {
    title: "Case action",
    parent: paths.caseParent,
    primary: paths.caseVariant,
    removed: paths.caseRemoved,
  };
  const head = {
    crumbs: [
      "branch [text]",
      "case [text]",
      "Action [text]",
      "secondary [text]",
    ],
    folders: "Branch › Case",
  };
  await removedSibling(page, host, family, head);
  await activation(page, host, family, head);
}

async function reusedParent(page: Page, host: BranchPointHost): Promise<void> {
  const removed = paths.reusedRemoved;
  await openEntry(page, host, removed);
  await expectHead(
    page,
    "default",
    ["branch [text]", "reused [text]", "action [text]", "default [text]"],
    "Branch › Reused",
  );
  // No eligible parent remains, so the head names the stored parent title
  // as plain text, under the branch-point lookup.
  await expect(page.locator('[data-inspect-section="details"]')).toContainText(
    "Former action",
  );
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
const CHECKS = {
  "moved-consumers": movedConsumers,
  "moved-parent": movedParent,
  "moved-variant": movedVariant,
  "case-renames": caseRenames,
  "reused-parent": reusedParent,
  "affected-destinations": affectedDestinations,
} as const satisfies Readonly<
  Record<string, (page: Page, host: BranchPointHost) => Promise<void>>
>;

/** The name of a shared case that has browser checks. */
export type BranchPointCase = keyof typeof CHECKS;

function isCase(name: string): name is BranchPointCase {
  return Object.hasOwn(CHECKS, name);
}

/**
 * Each case of `tests/fixtures/branch_point_cases.json` with its name, its
 * checks, and the title that starts its test names. A case without checks, or checks
 * without a case, stops the spec from loading, so the browser runs every
 * shared case.
 */
export const BRANCH_POINT_CHECKS = branchPointCases.map(({ name }) => {
  if (!isCase(name)) throw new Error(`No browser checks for the case ${name}`);
  return { name, title: name.replaceAll("-", " "), check: CHECKS[name] };
});
if (BRANCH_POINT_CHECKS.length !== Object.keys(CHECKS).length)
  throw new Error("Browser checks name a case that the shared set lacks");
