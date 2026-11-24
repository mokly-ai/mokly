/**
 * Affected destinations on each host. Badge's moved consumers keep their
 * links. Tally's existing Affected consumers offer the band while their linked
 * views show Unmodified: Meter and its variant out of Changes, Slip as a pure
 * move, and Ledger, which Changes lists for its desktop view. Its Added
 * consumer opens Current without a comparison request because it has no base
 * view.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import type { UsageLink } from "../../packages/model/dist/index.js";
import { branchPointPaths as paths } from "../helpers/branch_point_sources.js";

import {
  expectAffectedBand,
  TALLY_AFFECTED,
} from "./branch_point_destinations.js";
import {
  type BranchPointHost,
  expectHead,
  expectRouted,
  openChanges,
  openEntry,
  variantBar,
} from "./branch_point_ui.js";
import {
  awaitRoutedDetail,
  compareState,
  comparisonFrames,
} from "./comparison_ui.js";
import {
  awaitSelectedComparison,
  selectedRequests,
} from "./serve_comparison_ui.js";
import { openInspectFold, viewportFrame } from "./workspace_actions.js";

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

/**
 * Open a changed component's Usage and return its Affected links. Its head
 * names it in its folders, which a press reveals in the catalogue.
 */
async function affectedLinks(
  page: Page,
  host: BranchPointHost,
  component: string,
  title: string,
): Promise<Locator> {
  await openEntry(page, host, component);
  const [root, folder, slug] = component.split("/");
  await expectHead(page, title, [
    `${root} [button]`,
    `${folder} [button]`,
    `${slug} [text]`,
  ]);
  const usage = await openInspectFold(page, "usage");
  await expect(usage.locator("[data-usage-section='used-by']")).toBeVisible();
  return usage.locator("[data-usage-section='affected'] a");
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
    "branch [button]",
    "consumers [button]",
    "archive [button]",
    "status [text]",
    "default [text]",
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual([
      "Status -> branch/consumers/archive/status",
      `default -> ${paths.movedConsumer} (current)`,
    ]);
}

/**
 * Follow one Affected link. Serve captures the comparison that the link asks
 * for on demand, so the click waits for it.
 */
async function follow(
  page: Page,
  host: BranchPointHost,
  link: Locator,
  comparison: string | null,
): Promise<void> {
  if (
    comparison !== null &&
    host.comparisons === "on demand" &&
    host.affectedLinks === "side by side"
  )
    await awaitSelectedComparison(page, () => link.click());
  else await link.click();
}

export async function affectedDestinations(
  page: Page,
  host: BranchPointHost,
): Promise<void> {
  const requests = selectedRequests(page);
  const open = () => affectedLinks(page, host, paths.impactComponent, "Tally");
  const affected = await open();
  await expect(affected).toHaveCount(TALLY_AFFECTED.length);
  const facts = await linkFacts(affected);
  expect(
    facts.map(({ text, path, comparison }) => [text, path, comparison]),
  ).toEqual(
    TALLY_AFFECTED.map(({ text, path, comparison }) => [
      text,
      `/view/${path}/`,
      comparison,
    ]),
  );
  for (const [index, destination] of TALLY_AFFECTED.entries()) {
    const { path, listed, comparison } = destination;
    if (index > 0) await open();
    const count = requests.length;
    await follow(page, host, affected.nth(index), comparison);
    await expectRouted(page, host, path);
    const viewport = facts[index]!.viewport as "desktop" | "mobile";
    await expectAffectedBand(page, host, destination, viewport);
    if (comparison === null) {
      await awaitRoutedDetail(page, path);
      // The live frames show, and the canvas holds no comparison.
      await expect(page.locator(viewportFrame(viewport))).toBeVisible();
      await expect(compareState(page)).toBeHidden();
      await expect(comparisonFrames(page)).toHaveCount(0);
      await expect(
        page.frameLocator(viewportFrame(viewport)).locator("h1"),
      ).toHaveText("New consumer");
      expect(requests).toHaveLength(count);
    }
    const row = (await openChanges(page)).locator(
      `a[data-nav-row][data-entry-id="${path}"]`,
    );
    if (listed) await expect(row).toBeVisible();
    else await expect(row).toBeHidden();
  }
}
