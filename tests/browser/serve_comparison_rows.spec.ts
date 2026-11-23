/**
 * Serve compares each compared row of a variant set under its own selected
 * generation: Overlay on Card's set stacks Card's and Featured's own versions,
 * and the page requests one selection for each of those rows, and none for
 * Fresh, which the branch added, or Archived, which it removed.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { modeButton } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  generationOf,
  PANE_SOURCE,
  selectedRequests,
} from "./serve_comparison_ui.js";
import { openPanelTab } from "./workspace_actions.js";

/** One row's Light frame on the canvas, while it shows Overlay. */
function overlayFrame(page: Page, title: string): Locator {
  return page
    .getByRole("figure", { name: new RegExp(`^${title} · Light\\b`, "u") })
    .filter({ has: page.locator('[data-compare-mode="overlay"]') });
}

/** The layer of a compared frame that presents one side's snapshot. */
function layer(frame: Locator, side: "after" | "before"): Locator {
  return frame.locator(
    `iframe[data-mokly-comparison-frame][${PANE_SOURCE}*="/snapshots/${side}/"]`,
  );
}

test("Overlay on a variant set stacks each compared row's own versions from its own generation", async ({
  page,
  changes,
}) => {
  const { addedVariant, changedVariant, component, removedVariant } =
    changes.paths;
  const requests = selectedRequests(page);
  await page.goto(`/view/${component}/`);
  // The compare modes stand in the right panel's Changes tab.
  await openPanelTab(page, "Changes");
  await modeButton(page, "Overlay").click();
  const generations: string[] = [];
  for (const [title, path] of [
    ["Card", component],
    ["Featured", changedVariant],
  ] as const) {
    const frame = overlayFrame(page, title);
    for (const side of ["before", "after"] as const)
      await expect(layer(frame, side)).toHaveAttribute(
        PANE_SOURCE,
        new RegExp(
          `/diffs/generations/selected-[^/]+/snapshots/${side}/mokly-generated/${path}/index\\.desktop\\.html$`,
          "u",
        ),
      );
    // Both layers of one row come from that row's generation.
    const before = await layer(frame, "before").getAttribute(PANE_SOURCE);
    const after = await layer(frame, "after").getAttribute(PANE_SOURCE);
    expect(generationOf(before!)).toBe(generationOf(after!));
    generations.push(generationOf(after!));
  }
  expect(generations[0]).not.toBe(generations[1]);
  const featured = overlayFrame(page, "Featured");
  await expect(
    layer(featured, "before").contentFrame().getByRole("heading"),
  ).toHaveText("Featured Before");
  await expect(
    layer(featured, "after").contentFrame().getByRole("heading"),
  ).toHaveText("Featured After");
  // Card's label is the same in both versions; its accent colour is not.
  const card = overlayFrame(page, "Card");
  for (const [side, colour] of [
    ["before", accentColor.Before],
    ["after", accentColor.After],
  ] as const) {
    const version = layer(card, side).contentFrame();
    await expect(version.getByRole("heading")).toHaveText("Card content");
    await expect(version.getByRole("article")).toHaveCSS("color", colour);
  }
  await expect
    .poll(() => requests.map((url) => url.searchParams.get("path")).sort())
    .toEqual([component, changedVariant].sort());
  for (const request of requests) expect(request.searchParams.size).toBe(1);
  const paths = requests.map((url) => url.searchParams.get("path"));
  for (const quiet of [addedVariant, removedVariant])
    expect(paths).not.toContain(quiet);
});
