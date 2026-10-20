/**
 * Selected live comparisons in Serve: a diff mode requests only the shown
 * entry's comparison, a refresh keeps that scope, and a sibling variant keeps
 * the mode while it requests its own result.
 */

import { expect } from "@playwright/test";

import { test } from "./serve_comparison_test.js";
import {
  awaitSelectedComparison,
  expectPresentedPane,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
} from "./serve_comparison_ui.js";
import {
  chooseScheme,
  chooseVariant,
  chooseViewport,
} from "./workspace_actions.js";

test("live Difference requests the active screen and keeps real before/current panes", async ({
  page,
  changes,
}) => {
  const changed = changes.paths.changed;
  const requests = selectedRequests(page);
  await page.goto(`/view/${changed}/`);
  await chooseViewport(page, "desktop");
  expect(requests).toEqual([]);
  await loadComparison(page, "Difference");
  await expect(
    page.frameLocator(".mb-pane--before iframe").locator("h1"),
  ).toHaveText("Before screen");
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator("h1"),
  ).toHaveText("After screen");
  expect(requests).toHaveLength(1);
  expect(requests[0]!.searchParams.get("path")).toBe(changed);
  expect(requests[0]!.searchParams.size).toBe(1);
  await expect(page.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  await expectPresentedPane(page.locator(".mb-pane--before iframe"));
  await expectPresentedPane(page.locator(".mb-pane--after iframe"));
  await chooseScheme(page, "dark");
  for (const pane of ["before", "after"])
    await expect(page.locator(`.mb-pane--${pane} iframe`)).toHaveAttribute(
      PANE_SOURCE,
      /\.desktop\.dark\.html$/u,
    );
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator("h1"),
  ).toHaveText("After screen");
  expect(requests).toHaveLength(1);
});

test("saved variant selection and refresh keep the selected comparison scope", async ({
  page,
}) => {
  // Badge and its saved variant both changed, so each offers a comparison.
  const badge = "branch/consumers/badge";
  const variant = `${badge}/default`;
  const requests = selectedRequests(page);
  await page.goto(`/view/${badge}/`);
  await chooseViewport(page, "mobile");
  await chooseVariant(page, "default");
  await expect(page).toHaveURL(new RegExp(`/view/${variant}/$`, "u"));
  await loadComparison(page, "Overlay");
  await expect(
    page.frameLocator(".mb-pane--before iframe").locator(".branch-badge"),
  ).toHaveText("Before Active");
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator(".branch-badge"),
  ).toHaveText("After Active");
  await loadComparison(page, "Refresh comparison");
  expect(requests).toHaveLength(2);
  for (const [index, request] of requests.entries()) {
    expect(request.searchParams.get("path")).toBe(variant);
    expect(request.searchParams.size).toBe(index === 0 ? 1 : 2);
  }
  expect(requests[1]!.searchParams.get("refresh")).toBe("1");
  // The parent keeps Overlay, so navigation itself requests its own result.
  await awaitSelectedComparison(page, () => chooseVariant(page, "Badge"));
  await expect(page).toHaveURL(new RegExp(`/view/${badge}/$`, "u"));
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator(".branch-badge"),
  ).toHaveText("After Badge");
  expect(requests).toHaveLength(3);
  expect(requests.at(-1)!.searchParams.get("path")).toBe(badge);
});
