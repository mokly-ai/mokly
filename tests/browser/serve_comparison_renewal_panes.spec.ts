/**
 * Renewal of a loaded selected comparison in Serve: one HEAD request renews
 * the generation before new panes load, later switches share it, Current and
 * navigation fence it, and a new revision cancels it in place.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { comparisonFrames, modeButton, navRow } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  generationOf,
  holdRenewal,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
  SELECTED_ENDPOINT,
  SELECTED_GENERATION,
} from "./serve_comparison_ui.js";
import { networkFailure } from "./shell_error_allowances.js";
import {
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

/** The Current version of the Light frame of the one shown viewport. */
function lightAfter(page: Page): Locator {
  return layer(comparedFrame(page, /^(?:Desktop|Mobile) · Light\b/u), "after");
}

/** Open the changed screen's Desktop frames and load their Overlay. */
async function openOverlay(page: Page, path: string): Promise<void> {
  await page.goto(`/view/${path}/`);
  await chooseViewport(page, "desktop");
  await openPanelTab(page, "Changes");
  await loadComparison(page, "Overlay");
}

test("retained snapshots share one renewal and use the latest viewport, theme and mode", async ({
  page,
  changes,
}) => {
  // Each selection and generation root that the page requests anew.
  const metadata: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === "GET" &&
      (path === SELECTED_ENDPOINT ||
        /\/diffs\/generations\/[^/]+\/$/u.test(path))
    )
      metadata.push(request.url());
  });
  await openOverlay(page, changes.paths.changed);
  await expect(lightAfter(page).contentFrame().locator("h1")).toHaveText(
    "After screen",
  );
  const original = await lightAfter(page).getAttribute(PANE_SOURCE);
  const originalMetadata = [...metadata];
  const pending = await holdRenewal(page);
  try {
    await openPanelTab(page, "Inspect");
    await chooseViewport(page, "mobile");
    await pending.arrived;
    // The Frames filter shows the Dark frames alone, as a theme switch.
    await setFrames(page, { dark: true, light: false });
    await chooseViewport(page, "both");
    await openPanelTab(page, "Changes");
    await modeButton(page, "Difference").click();
    expect(pending.requests()).toBe(1);
    await pending.release();
    // The one renewal served every switch; nothing cancelled it.
    expect(pending.outcomes()).toEqual(["delivered"]);
    await expect(comparisonFrames(page)).toHaveCount(4);
    for (const [viewport, name] of [
      ["mobile", /^Mobile · Dark\b/u],
      ["desktop", /^Desktop · Dark\b/u],
    ] as const) {
      const view = comparedFrame(page, name);
      await expect(view.locator("[data-compare-mode]")).toHaveAttribute(
        "data-compare-mode",
        "difference",
      );
      await expect(layer(view, "after")).toHaveAttribute(
        PANE_SOURCE,
        original!.replace(/desktop\.html$/u, `${viewport}.dark.html`),
      );
      await expect(
        layer(view, "after").contentFrame().locator("h1"),
      ).toHaveText("After screen");
    }
    expect(pending.requests()).toBe(1);
    expect(metadata).toEqual(originalMetadata);
  } finally {
    pending.unblock();
  }
});

for (const destination of ["Current", "another screen"] as const)
  test(`a pending renewal cannot replace ${destination}`, async ({
    page,
    changes,
  }) => {
    await openOverlay(page, changes.paths.changed);
    const pending = await holdRenewal(page);
    try {
      await openPanelTab(page, "Inspect");
      await chooseViewport(page, "mobile");
      await pending.arrived;
      if (destination === "Current") {
        await openPanelTab(page, "Changes");
        await modeButton(page, "Current").click();
      } else {
        await navRow(page, changes.paths.component).click();
        // The canvas shows the compare only while Changes is the selected
        // tab, so the destination's frames are checked there.
        await openPanelTab(page, "Changes");
      }
      await pending.release();
      // Leaving the comparison cancelled the renewal before its response.
      expect(pending.outcomes()).toEqual(["cancelled"]);
      await expect(comparisonFrames(page)).toHaveCount(0);
      // The canvas shows the destination's current frames.
      await expect(
        page.getByRole("figure", {
          name:
            destination === "Current"
              ? /^Mobile · Light\b/u
              : /^Card · Light\b/u,
        }),
      ).toBeVisible();
      await openPanelTab(page, "Changes");
      await expect(modeButton(page, "Current")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      if (destination === "another screen")
        await expect(page).toHaveURL(
          new RegExp(`/view/${changes.paths.component}/$`, "u"),
        );
    } finally {
      pending.unblock();
    }
  });

test("renewal failure offers a retry that reacquires the selected comparison", async ({
  page,
  changes,
  allowBrowserError,
}) => {
  await openOverlay(page, changes.paths.changed);
  const generation = generationOf(
    (await lightAfter(page).getAttribute(PANE_SOURCE))!,
  );
  allowBrowserError(networkFailure(changes.url, new URL(generation).pathname));
  await page.route(SELECTED_GENERATION, (route) => route.abort("failed"), {
    times: 1,
  });
  // One change of the shown frames, the Mobile column, renews the row. A
  // second change would request the failed row again for its new frames.
  await openPanelTab(page, "Inspect");
  await chooseViewport(page, "both");
  await openPanelTab(page, "Changes");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(comparisonFrames(page)).toHaveCount(0);
  await loadComparison(page, "Try again");
  const mobile = comparedFrame(page, /^Mobile · Light\b/u);
  await expect(layer(mobile, "before").contentFrame().locator("h1")).toHaveText(
    "Before screen",
  );
  await expect(layer(mobile, "after").contentFrame().locator("h1")).toHaveText(
    "After screen",
  );
  await expect(layer(mobile, "after")).toHaveAttribute(
    PANE_SOURCE,
    /\.mobile\.html$/u,
  );
});

test("a pending renewal cannot restore a previously selected saved variant", async ({
  page,
  changes,
}) => {
  const card = changes.paths.component;
  /** Expect the Current version of Side by side to show `heading` of a Card. */
  const expectCurrent = async (name: RegExp, heading: string) => {
    const version = layer(comparedFrame(page, name), "after").contentFrame();
    await expect(version.getByRole("heading")).toHaveText(heading);
    await expect(version.getByRole("article")).toHaveCSS(
      "color",
      accentColor.After,
    );
  };
  await page.goto(`/view/${changes.paths.changedVariant}/`);
  await chooseViewport(page, "desktop");
  await openPanelTab(page, "Changes");
  await loadComparison(page, "Side by side");
  await expectCurrent(/^Current Featured · Light\b/u, "Featured After");
  const pending = await holdRenewal(page);
  try {
    // A variant set shows desktop frames alone, so its scheme renews instead.
    await openPanelTab(page, "Inspect");
    await setFrames(page, { dark: true, light: false });
    await pending.arrived;
    await navRow(page, card).click();
    await openPanelTab(page, "Changes");
    await expectCurrent(/^Current Card · Dark\b/u, "Card content");
    await pending.release();
    // Choosing the sibling cancelled the renewal before its response.
    expect(pending.outcomes()).toEqual(["cancelled"]);
    await expect(page).toHaveURL(new RegExp(`/view/${card}/$`, "u"));
    await expectCurrent(/^Current Card · Dark\b/u, "Card content");
  } finally {
    pending.unblock();
  }
});

test("new evidence cancels renewal in place and the next comparison uses fresh snapshots", async ({
  page,
  changes,
}) => {
  const requests = selectedRequests(page);
  await openOverlay(page, changes.paths.changed);
  const frame = lightAfter(page);
  await expect(frame.contentFrame().locator("h1")).toHaveText("After screen");
  const snapshot = (await frame.getAttribute(PANE_SOURCE))!;
  const root = page.locator("html");
  await root.evaluate((element) =>
    element.setAttribute("data-test-retained", "true"),
  );
  const pending = await holdRenewal(page);
  try {
    await openPanelTab(page, "Inspect");
    await chooseViewport(page, "mobile");
    await pending.arrived;
    const consumer = changes.paths.consumer;
    await changes.edit(
      `specs/${consumer}.screen.html`,
      '---\ntitle: Consumer renamed\n---\n<h1>Consumer screen</h1>\n<ui-card label="Card content"></ui-card>',
      (index) =>
        index.screens.find((entry) => entry.path === consumer)?.title ===
        "Consumer renamed",
    );
    await expect(navRow(page, consumer)).toContainText("Consumer renamed");
    await expect(root).toHaveAttribute("data-test-retained", "true");
    await openPanelTab(page, "Changes");
    await expect(modeButton(page, "Current")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await pending.release();
    // The new revision cancelled the renewal before its response.
    expect(pending.outcomes()).toEqual(["cancelled"]);
    await expect(comparisonFrames(page)).toHaveCount(0);
    expect(requests).toHaveLength(1);
    await loadComparison(page, "Overlay");
    await expect(frame.contentFrame().locator("h1")).toHaveText("After screen");
    expect(generationOf((await frame.getAttribute(PANE_SOURCE))!)).not.toBe(
      generationOf(snapshot),
    );
    expect(requests).toHaveLength(2);
    expect(requests[1]!.searchParams.get("path")).toBe(changes.paths.changed);
  } finally {
    pending.unblock();
  }
});
