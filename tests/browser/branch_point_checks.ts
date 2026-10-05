/**
 * The rendered UI each shared branch-point case must show in every host:
 * usage destinations, saved props, removed rows, retained comparison mode,
 * Changes activation and crumbs.
 */

import { expect, type Page } from "@playwright/test";

import type { BranchPointCase } from "../helpers/branch_point_sources.js";

import type { BranchHost, BranchHostKind } from "./branch_hosts.js";
import {
  newParentVariant,
  removedScreenUsage,
  removedVariantOrder,
} from "./branch_point_follow_up_checks.js";
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

type Check = (
  page: Page,
  host: BranchHost,
  kind: BranchHostKind,
) => Promise<void>;

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

const movedConsumers: Check = async (page, host, kind) => {
  await openEntry(page, host, "library/badge");
  await expectHead(page, "Badge", ["Library [button]"]);
  await inspectorTab(page, "Usage");
  await expect(page.locator("[data-usage-section='used-by']")).toBeVisible();
  const affected = page.locator("[data-usage-section='affected'] a");
  if (kind === "viewer") {
    // The public catalogue carries no affected-consumer evidence, so the
    // embedded viewer never lists affected consumers to resolve.
    await expect(affected).toHaveCount(0);
    return;
  }
  await expect(affected).toHaveCount(2);
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
    ["Status · default", "/view/library/archive/status/default/", false],
    ["Receipt", "/view/shop/archive/receipt/", false],
  ]);
  await affected.first().click();
  await expectRouted(page, kind, "library/archive/status/default");
  await expectHead(page, "Status", [
    "Library [button]",
    "Archive [button]",
    "Status -> /view/library/archive/status/",
  ]);
};

/** A removed sibling opens inside the comparison mode its siblings use. */
async function removedSibling(
  page: Page,
  kind: BranchHostKind,
  parent: string,
  primary: string,
  removed: string,
): Promise<void> {
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      `primary -> ${primary} (current)`,
      `secondary · Removed -> ${removed}`,
    ]);
  await compareSideBySide(page);
  await expectSavedProps(page, ...PROPS);
  await selectVariant(page, removed);
  await expectRouted(page, kind, removed);
  await expect(page.locator("[data-diff-mode=side]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectHead(page, "Action", [
    "Library [text]",
    `Action -> /view/${parent}/`,
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      `primary -> ${primary}`,
      `secondary · Removed -> ${removed} (current)`,
    ]);
  await expectRemovedRow(page, parent, removed);
}

const movedParent: Check = async (page, host, kind) => {
  const removed = "library/action/secondary";
  await openEntry(page, host, "library/archive/action/primary");
  await expectHead(page, "Action", [
    "Library -> /view/library/",
    "Archive [button]",
    "Action -> /view/library/archive/action/",
  ]);
  await removedSibling(
    page,
    kind,
    "library/archive/action",
    "library/archive/action/primary",
    removed,
  );
  await activateRow(page, "library");
  await expectRouted(page, kind, "library/archive/action");
  await search(page, "secondary");
  await activateRow(page, "library");
  await expectRouted(page, kind, removed);
  await expectHead(page, "Action", [
    "Library [text]",
    "Action -> /view/library/archive/action/",
  ]);
};

const movedVariant: Check = async (page, host, kind) => {
  await openEntry(page, host, "library/donor/spare");
  await expectHead(page, "Donor", [
    "Library [button]",
    "Donor -> /view/library/donor/",
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual(["spare -> library/donor/spare (current)"]);
  await activateRow(page, "library/receiver");
  await expectRouted(page, kind, "library/receiver/primary");
  await expectHead(page, "Receiver", [
    "Library [button]",
    "Receiver -> /view/library/receiver/",
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "default -> library/receiver/default",
      "primary -> library/receiver/primary (current)",
    ]);
  await compareSideBySide(page);
  await expectSavedProps(page, ...PROPS);
  const nav = await openChanges(page);
  await expect(
    nav.locator(
      '[data-nav-disclosure="variants:library/receiver"] a[data-entry-id="library/receiver/primary"]',
    ),
  ).toHaveCount(1);
};

const caseRenames: Check = async (page, host, kind) => {
  const removed = "library/Action/secondary";
  await openEntry(page, host, "library/action/primary");
  await expectHead(page, "Action", [
    "Library [button]",
    "Action -> /view/library/action/",
  ]);
  await removedSibling(
    page,
    kind,
    "library/action",
    "library/action/primary",
    removed,
  );
  await activateRow(page, "library/action");
  await expectRouted(page, kind, "library/action/primary");
  await search(page, "secondary");
  await activateRow(page, "library/action");
  await expectRouted(page, kind, removed);
};

const reusedParent: Check = async (page, host) => {
  const removed = "library/action/default";
  await openEntry(page, host, removed);
  await expectHead(page, "Default", ["Library [text]", "Action [text]"]);
  const nav = await openChanges(page);
  await expect(nav.locator(`a[data-entry-id="${removed}"]`)).toHaveCount(1);
  await expect(
    nav.locator(`[data-nav-variants] a[data-entry-id="${removed}"]`),
  ).toHaveCount(0);
  await expect(
    nav.locator('[data-nav-disclosure="variants:library/action"]'),
  ).toHaveCount(0);
};

/** The workspaces whose comparison mode a case carries between siblings. */
export const BRANCH_POINT_COMPARED: Readonly<
  Record<BranchPointCase, readonly string[]>
> = {
  "moved-consumers": [],
  "moved-parent": [
    "library/archive/action/primary",
    "library/action/secondary",
  ],
  "moved-variant": [],
  "case-renames": ["library/action/primary", "library/Action/secondary"],
  "reused-parent": [],
  "removed-screen-usage": [],
  "removed-variant-order": [],
  "new-parent-variant": [],
};

/** Every case's checks, keyed by the shared fixture name. */
export const BRANCH_POINT_CHECKS: Readonly<Record<BranchPointCase, Check>> = {
  "moved-consumers": movedConsumers,
  "moved-parent": movedParent,
  "moved-variant": movedVariant,
  "case-renames": caseRenames,
  "reused-parent": reusedParent,
  "removed-screen-usage": removedScreenUsage,
  "removed-variant-order": removedVariantOrder,
  "new-parent-variant": newParentVariant,
};
