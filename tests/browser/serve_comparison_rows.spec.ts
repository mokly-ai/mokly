/**
 * Serve compares each compared row of a variant set under its own selected
 * generation: Overlay on Card's set stacks Card's and Featured's own versions,
 * and the page requests one selection for each of those rows, and none for
 * Fresh, which the branch added, or Archived, which it removed. A set offers
 * its Changes tab and its compare modes while any shown row compares, also
 * when the routed row does not.
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

test("a variant set whose routed row has no comparison offers the Changes tab and compares its changed rows", async ({
  page,
  changes,
}) => {
  const { paths } = changes;
  // Tag's own row and Plain are unmodified, Bold changed, and the canvas
  // does not show Old, which the branch removed. On Card's set, the branch
  // added Fresh and changed Card and Featured.
  const cases = [
    {
      name: "the Tag set on its own route",
      route: paths.quietParent,
      changed: [["Bold", paths.quietVariant]],
      current: ["Tag", "Plain"],
    },
    {
      name: "the Card set opened on Fresh",
      route: paths.addedVariant,
      changed: [
        ["Card", paths.component],
        ["Featured", paths.changedVariant],
      ],
      current: ["Fresh"],
    },
  ] as const;
  for (const { changed, current, name, route } of cases) {
    const requests = selectedRequests(page);
    await page.goto(`/view/${route}/`);
    await expect(
      page.getByRole("tab", { name: "Changes", exact: true }),
      `${name}: the Changes tab`,
    ).toBeVisible();
    await openPanelTab(page, "Changes");
    const overlay = modeButton(page, "Overlay");
    await expect(overlay, `${name}: the Overlay mode`).toBeVisible();
    await overlay.click();
    const generations = new Set<string>();
    for (const [title, path] of changed) {
      const frame = overlayFrame(page, title);
      for (const side of ["before", "after"] as const)
        await expect(
          layer(frame, side),
          `${name}: ${title}'s ${side} layer`,
        ).toHaveAttribute(
          PANE_SOURCE,
          new RegExp(
            `/diffs/generations/selected-[^/]+/snapshots/${side}/mokly-generated/${path}/index\\.desktop\\.html$`,
            "u",
          ),
        );
      const before = await layer(frame, "before").getAttribute(PANE_SOURCE);
      const after = await layer(frame, "after").getAttribute(PANE_SOURCE);
      expect(
        generationOf(before!),
        `${name}: ${title}'s two layers come from one generation`,
      ).toBe(generationOf(after!));
      generations.add(generationOf(after!));
    }
    expect(generations.size, `${name}: each changed row's own generation`).toBe(
      changed.length,
    );
    for (const title of current) {
      const live = page.getByRole("figure", {
        name: new RegExp(`^${title} · Light\\b`, "u"),
      });
      await expect(live, `${name}: ${title}'s live frame`).toBeVisible();
      await expect(
        live.locator("[data-compare-mode]"),
        `${name}: ${title}'s frame compares nothing`,
      ).toHaveCount(0);
    }
    await expect
      .poll(() => requests.map((url) => url.searchParams.get("path")).sort(), {
        message: `${name}: one selection for each changed row alone`,
      })
      .toEqual(changed.map(([, path]) => path).sort());
  }
});
