/**
 * Selected live comparisons in Serve: a diff mode requests the comparison of
 * each compared row that the canvas shows, a refresh requests each of them
 * again, and moving between the rows of a variant set keeps the mode and
 * every row's comparison without a new request.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { test } from "./serve_comparison_test.js";
import {
  expectPresentedPane,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
} from "./serve_comparison_ui.js";
import {
  chooseVariant,
  chooseViewport,
  openPanelTab,
  setFrames,
} from "./workspace_actions.js";

/** A frame of the canvas, named `name`, that holds a compared document. */
function comparedFrame(page: Page, name: RegExp): Locator {
  return page
    .getByRole("figure", { name })
    .filter({ has: page.locator("[data-compare-mode]") });
}

/** The version of a compared frame that presents one side's snapshot. */
function layer(frame: Locator, side: "after" | "before"): Locator {
  return frame.locator(
    `iframe[data-mokly-comparison-frame][${PANE_SOURCE}*="/snapshots/${side}/"]`,
  );
}

/**
 * Expect a version of a Card comparison against the fixture's own base to
 * show `heading` and the accent colour of that side's commit.
 */
async function expectCardVersion(
  version: Locator,
  side: "after" | "before",
  heading: string,
): Promise<void> {
  const document = version.contentFrame();
  await expect(document.getByRole("heading")).toHaveText(heading);
  await expect(document.getByRole("article")).toHaveCSS(
    "color",
    accentColor[side === "before" ? "Before" : "After"],
  );
}

test("live Difference requests the active screen and keeps real before/current panes", async ({
  page,
  changes,
}) => {
  const changed = changes.paths.changed;
  const requests = selectedRequests(page);
  await page.goto(`/view/${changed}/`);
  await chooseViewport(page, "desktop");
  expect(requests).toEqual([]);
  await openPanelTab(page, "Changes");
  await loadComparison(page, "Difference");
  const light = comparedFrame(page, /^Desktop · Light\b/u);
  await expect(layer(light, "before").contentFrame().locator("h1")).toHaveText(
    "Before screen",
  );
  await expect(layer(light, "after").contentFrame().locator("h1")).toHaveText(
    "After screen",
  );
  expect(requests).toHaveLength(1);
  expect(requests[0]!.searchParams.get("path")).toBe(changed);
  expect(requests[0]!.searchParams.size).toBe(1);
  await expect(light.locator("[data-compare-mode]")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  await expectPresentedPane(layer(light, "before"));
  await expectPresentedPane(layer(light, "after"));
  // The Frames filter shows the Dark views alone; the same selection has them.
  await openPanelTab(page, "Inspect");
  await setFrames(page, { dark: true, light: false });
  // The canvas shows the compare only while Changes is the selected tab.
  await openPanelTab(page, "Changes");
  const dark = comparedFrame(page, /^Desktop · Dark\b/u);
  for (const side of ["before", "after"] as const)
    await expect(layer(dark, side)).toHaveAttribute(
      PANE_SOURCE,
      /\.desktop\.dark\.html$/u,
    );
  await expect(layer(dark, "after").contentFrame().locator("h1")).toHaveText(
    "After screen",
  );
  expect(requests).toHaveLength(1);
});

test("saved variant selection and refresh keep each compared row's comparison scope", async ({
  page,
  changes,
}) => {
  // Card and its Featured variant both changed, so each row compares. The
  // changed .accent rule belongs to Card, so Featured's evidence names its
  // parent as the owner.
  const card = changes.paths.component;
  const featured = changes.paths.changedVariant;
  const requests = selectedRequests(page);
  await page.goto(`/view/${card}/`);
  await chooseViewport(page, "mobile");
  await chooseVariant(page, "Featured");
  // The wide canvas selects Featured's frame in place, on the set's route.
  await expect(
    page.getByRole("button", { name: "Featured · Light", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(new RegExp(`/view/${card}/$`, "u"));
  await openPanelTab(page, "Changes");
  await loadComparison(page, "Overlay");
  const featuredFrame = comparedFrame(page, /^Featured · Light\b/u);
  await expect(featuredFrame.locator("[data-compare-mode]")).toHaveAttribute(
    "data-compare-mode",
    "overlay",
  );
  await expectCardVersion(
    layer(featuredFrame, "before"),
    "before",
    "Featured Before",
  );
  await expectCardVersion(
    layer(featuredFrame, "after"),
    "after",
    "Featured After",
  );
  await expect(
    layer(comparedFrame(page, /^Card · Light\b/u), "after"),
  ).toHaveAttribute(PANE_SOURCE, /\/selected-[^/]+\/snapshots\/after\//u);
  await loadComparison(page, "Refresh comparison");
  // Card and Featured each request their own comparison, then refresh it.
  await expect.poll(() => requests.length).toBe(4);
  const paths = (urls: URL[]) =>
    urls.map((url) => url.searchParams.get("path")).sort();
  expect(paths(requests.slice(0, 2))).toEqual([card, featured].sort());
  expect(paths(requests.slice(2))).toEqual([card, featured].sort());
  for (const [index, request] of requests.entries())
    expect(request.searchParams.size).toBe(index < 2 ? 1 : 2);
  for (const request of requests.slice(2))
    expect(request.searchParams.get("refresh")).toBe("1");
  // The parent keeps Overlay and its own comparison: its row requests nothing.
  await openPanelTab(page, "Inspect");
  await chooseVariant(page, "Card");
  await expect(page).toHaveURL(new RegExp(`/view/${card}/$`, "u"));
  await openPanelTab(page, "Changes");
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  const before = comparedFrame(page, /^Before Card · Light\b/u);
  const current = comparedFrame(page, /^Current Card · Light\b/u);
  await expect(current.locator("[data-compare-mode]")).toHaveAttribute(
    "data-compare-mode",
    "side",
  );
  await expectCardVersion(layer(before, "before"), "before", "Card content");
  await expectCardVersion(layer(current, "after"), "after", "Card content");
  expect(requests).toHaveLength(4);
  // Card's versions come from Card's own selection.
  await expect(layer(current, "after")).toHaveAttribute(
    PANE_SOURCE,
    new RegExp(
      `/snapshots/after/mokly-generated/${card}/index\\.desktop\\.html$`,
      "u",
    ),
  );
  expect(requests.map((url) => url.searchParams.get("path"))).toContain(card);
});
