/**
 * Affected destinations on each host. Badge's moved consumers keep their
 * links, and under user decision 103 C each of Tally's Affected links opens a
 * destination that offers the band for the linked view while that view shows
 * Unmodified: Meter and its variant out of Changes, Slip as a pure move, and
 * Ledger, which Changes lists for its desktop view.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import type { UsageLink } from "../../packages/viewer/src/generated/catalogue/UsageLink.js";
import { branchPointPaths as paths } from "../helpers/branch_point_sources.js";

import {
  type BranchPointHost,
  expectHead,
  expectRouted,
  inspectorTab,
  openChanges,
  openEntry,
  variantBar,
} from "./branch_point_ui.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";

/** Badge keeps each current destination, including the consumer's own variant. */
export function expectBadgeAffected(affected: UsageLink[]) {
  const destinations = new Map(
    affected.map(({ entryPath, entryKind, removed }) => {
      const destination = { entryPath, entryKind, removed };
      return [JSON.stringify(destination), destination];
    }),
  );
  expect(
    [...destinations.values()].sort((left, right) =>
      left.entryPath.localeCompare(right.entryPath),
    ),
  ).toEqual([
    {
      entryPath: "branch/consumers/archive/receipt",
      entryKind: "screen",
      removed: false,
    },
    {
      entryPath: "branch/consumers/archive/status",
      entryKind: "component",
      removed: false,
    },
    {
      entryPath: "branch/consumers/archive/status/default",
      entryKind: "component",
      removed: false,
    },
  ]);
}

/** Open a changed component's Usage and return its Affected links. */
async function affectedLinks(
  page: Page,
  host: BranchPointHost,
  component: string,
  title: string,
  folder: string,
): Promise<Locator> {
  await openEntry(page, host, component);
  await expectHead(page, title, ["Branch [button]", `${folder} [button]`]);
  await inspectorTab(page, "Usage");
  await expect(page.locator("[data-usage-section='used-by']")).toBeVisible();
  return page.locator("[data-usage-section='affected'] a");
}

/** Each link as its text, path, comparison intent, and named viewport. */
function linkFacts(links: Locator) {
  return links.evaluateAll((elements) =>
    elements.map((link) => {
      const url = new URL(link.getAttribute("href")!, location.href);
      return {
        text: link.textContent,
        path: url.pathname,
        comparison: url.searchParams.get("comparison"),
        viewport: url.searchParams.get("viewport"),
      };
    }),
  );
}

export async function movedConsumers(
  page: Page,
  host: BranchPointHost,
): Promise<void> {
  const affected = await affectedLinks(
    page,
    host,
    "branch/consumers/badge",
    "Badge",
    "Consumers",
  );
  // A variant consumer is its own destination, titled by the variant. Each
  // link asks for its consumer's comparison.
  await expect(affected).toHaveCount(3);
  expect(
    (await linkFacts(affected)).map(({ text, path, comparison }) => [
      text,
      path,
      comparison,
    ]),
  ).toEqual([
    ["Status", "/view/branch/consumers/archive/status/", "side"],
    ["default", `/view/${paths.movedConsumer}/`, "side"],
    ["Receipt", `/view/${paths.movedScreen}/`, "side"],
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

/** Tally's Affected links in list order, each with its stage noun and row. */
const TALLY_AFFECTED = [
  ["Meter", paths.impactParent, "variant", false],
  ["default", paths.impactVariant, "variant", false],
  ["Slip", paths.impactMoved, "screen", true],
  ["Ledger", paths.impactLedger, "screen", true],
] as const;

/**
 * Follow one Affected link. Serve captures the comparison that the link asks
 * for on demand, so the click waits for it.
 */
async function follow(
  page: Page,
  host: BranchPointHost,
  link: Locator,
): Promise<void> {
  if (host.comparisons === "on demand" && host.affectedLinks === "side by side")
    await awaitSelectedComparison(page, () => link.click());
  else await link.click();
}

/**
 * The destination shows Unmodified and offers the band for the linked view.
 * Serve and the copy open its Side by side comparison, whose stage says that
 * the components the view uses changed; a React host opens Current.
 */
async function expectAffectedBand(
  page: Page,
  host: BranchPointHost,
  viewport: string,
  noun: "screen" | "variant",
): Promise<void> {
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  const mode = host.affectedLinks === "current" ? "current" : "side";
  await expect(page.locator(`[data-diff-mode=${mode}]`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (mode === "current") return;
  const label = viewport === "mobile" ? "Mobile" : "Desktop";
  await expect(page.locator("[data-diff-viewport] > h3")).toHaveText([
    `${label} · Components this ${noun} uses changed`,
  ]);
}

export async function affectedDestinations(
  page: Page,
  host: BranchPointHost,
): Promise<void> {
  const open = () =>
    affectedLinks(page, host, paths.impactComponent, "Tally", "Impact");
  const affected = await open();
  await expect(affected).toHaveCount(TALLY_AFFECTED.length);
  const facts = await linkFacts(affected);
  expect(
    facts.map(({ text, path, comparison }) => [text, path, comparison]),
  ).toEqual(
    TALLY_AFFECTED.map(([text, path]) => [text, `/view/${path}/`, "side"]),
  );
  for (const [index, [, path, noun, listed]] of TALLY_AFFECTED.entries()) {
    if (index > 0) await open();
    await follow(page, host, affected.nth(index));
    await expectRouted(page, host, path);
    await expectAffectedBand(page, host, facts[index]!.viewport!, noun);
    const row = (await openChanges(page)).locator(
      `a[data-nav-row][data-entry-id="${path}"]`,
    );
    if (listed) await expect(row).toBeVisible();
    else await expect(row).toBeHidden();
  }
}
