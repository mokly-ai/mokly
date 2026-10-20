/**
 * Renewal of a loaded selected comparison in Serve: one HEAD request renews
 * the generation before new panes load, later switches share it, Current and
 * navigation fence it, and a new revision cancels it in place.
 */

import { expect } from "@playwright/test";

import { modeButton, navRow } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  generationOf,
  holdRenewal,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
  SELECTED_GENERATION,
} from "./serve_comparison_ui.js";
import { networkFailure } from "./shell_error_allowances.js";
import {
  chooseScheme,
  chooseVariant,
  chooseViewport,
} from "./workspace_actions.js";

const after = ".mb-pane--after iframe";
const before = ".mb-pane--before iframe";

test("retained snapshots share one renewal and use the latest viewport, theme and mode", async ({
  page,
  changes,
}) => {
  const metadata: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes("review.json"))
      metadata.push(request.url());
  });
  await page.goto(`/view/${changes.paths.changed}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Overlay");
  await expect(page.frameLocator(after).locator("h1")).toHaveText(
    "After screen",
  );
  const original = await page.locator(after).getAttribute(PANE_SOURCE);
  const originalMetadata = [...metadata];
  const pending = await holdRenewal(page);
  try {
    await chooseViewport(page, "mobile");
    await pending.arrived;
    await chooseScheme(page, "dark");
    await chooseViewport(page, "both");
    await modeButton(page, "Difference").click();
    expect(pending.requests()).toBe(1);
    await pending.release();
    // The one renewal served every switch; nothing cancelled it.
    expect(pending.outcomes()).toEqual(["delivered"]);
    await expect(page.locator(".mb-pane iframe")).toHaveCount(4);
    for (const viewport of ["mobile", "desktop"]) {
      const view = page.locator(`[data-diff-viewport="${viewport}"]`);
      await expect(view.locator(".mb-panes")).toHaveAttribute(
        "data-compare-mode",
        "difference",
      );
      await expect(view.locator(after)).toHaveAttribute(
        PANE_SOURCE,
        original!.replace(/desktop\.html$/u, `${viewport}.dark.html`),
      );
      await expect(view.locator(after).contentFrame().locator("h1")).toHaveText(
        "After screen",
      );
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
    await page.goto(`/view/${changes.paths.changed}/`);
    await chooseViewport(page, "desktop");
    await loadComparison(page, "Overlay");
    const pending = await holdRenewal(page);
    try {
      await chooseViewport(page, "mobile");
      await pending.arrived;
      if (destination === "Current") await modeButton(page, "Current").click();
      else await navRow(page, changes.paths.component).click();
      await pending.release();
      // Leaving the comparison cancelled the renewal before its response.
      expect(pending.outcomes()).toEqual(["cancelled"]);
      await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
      await expect(page.locator("[data-current-screen]")).toBeVisible();
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
  await page.goto(`/view/${changes.paths.changed}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Overlay");
  const generation = generationOf(
    (await page.locator(after).getAttribute(PANE_SOURCE))!,
  );
  allowBrowserError(
    networkFailure(changes.url, new URL(`${generation}review.json`).pathname),
  );
  await page.route(SELECTED_GENERATION, (route) => route.abort("failed"), {
    times: 1,
  });
  await chooseViewport(page, "mobile");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
  await loadComparison(page, "Try again");
  await expect(page.frameLocator(before).locator("h1")).toHaveText(
    "Before screen",
  );
  await expect(page.frameLocator(after).locator("h1")).toHaveText(
    "After screen",
  );
  await expect(page.locator(after)).toHaveAttribute(
    PANE_SOURCE,
    /\.mobile\.html$/u,
  );
});

test("a pending renewal cannot restore a previously selected saved variant", async ({
  page,
  changes,
}) => {
  const card = changes.paths.component;
  await page.goto(`/view/${changes.paths.changedVariant}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Side by side");
  const label = page.frameLocator(after).locator("h2");
  await expect(label).toHaveText("Featured After");
  const pending = await holdRenewal(page);
  try {
    await chooseViewport(page, "mobile");
    await pending.arrived;
    await chooseVariant(page, "Card");
    await expect(label).toHaveText("Card content");
    await pending.release();
    // Choosing the sibling cancelled the renewal before its response.
    expect(pending.outcomes()).toEqual(["cancelled"]);
    await expect(page).toHaveURL(new RegExp(`/view/${card}/$`, "u"));
    await expect(label).toHaveText("Card content");
  } finally {
    pending.unblock();
  }
});

test("new evidence cancels renewal in place and the next comparison uses fresh snapshots", async ({
  page,
  changes,
}) => {
  const requests = selectedRequests(page);
  await page.goto(`/view/${changes.paths.changed}/`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Overlay");
  const frame = page.locator(after);
  await expect(frame.contentFrame().locator("h1")).toHaveText("After screen");
  const snapshot = (await frame.getAttribute(PANE_SOURCE))!;
  const root = page.locator("html");
  await root.evaluate((element) =>
    element.setAttribute("data-test-retained", "true"),
  );
  const pending = await holdRenewal(page);
  try {
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
    await expect(modeButton(page, "Current")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await pending.release();
    // The new revision cancelled the renewal before its response.
    expect(pending.outcomes()).toEqual(["cancelled"]);
    await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(0);
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
