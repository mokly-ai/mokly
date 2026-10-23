/**
 * A failed selected comparison in Serve stays in the screen and retries only
 * when the reader asks. The retry and a later refresh each request a new
 * capture, and the refresh presents new snapshots.
 */

import { expect } from "@playwright/test";

import { modeButton } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import {
  generationOf,
  loadComparison,
  PANE_SOURCE,
  selectedRequests,
  SELECTED_ENDPOINT,
} from "./serve_comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";

const BEFORE_SNAPSHOT =
  /\/mokly-viewer\/diffs\/generations\/selected-[^/]+\/snapshots\/before\//u;

test("a failed comparison stays in the screen and retries explicitly", async ({
  page,
  changes,
  allowBrowserError,
}) => {
  const changed = changes.paths.changed;
  const failing = `${SELECTED_ENDPOINT}?path=${encodeURIComponent(changed)}`;
  allowBrowserError(responseFailure(changes.url, failing, 503));
  // One capture that Serve cannot finish, with Serve's own failure body.
  await page.route(
    `**${failing}`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "comparison-unavailable",
          message: "The comparison is unavailable. Try again.",
        }),
      }),
    { times: 1 },
  );
  const requests = selectedRequests(page);
  const frames = page.locator("[data-diff-stage] iframe");
  await page.goto(`/view/${changed}/`);
  await modeButton(page, "Overlay").click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(requests).toHaveLength(1);

  await loadComparison(page, "Try again");
  await expect(frames).toHaveCount(4);
  await expect(frames.first()).toHaveAttribute(PANE_SOURCE, BEFORE_SNAPSHOT);
  const retried = (await frames.first().getAttribute(PANE_SOURCE))!;

  await loadComparison(page, "Refresh comparison");
  await expect(frames).toHaveCount(4);
  await expect(frames.first()).not.toHaveAttribute(PANE_SOURCE, retried);
  await expect(frames.first()).toHaveAttribute(PANE_SOURCE, BEFORE_SNAPSHOT);
  const refreshed = (await frames.first().getAttribute(PANE_SOURCE))!;
  expect(generationOf(refreshed)).not.toBe(generationOf(retried));
  // Only the reader's retry and refresh ask Serve for a new capture.
  expect(requests.map((url) => url.searchParams.get("refresh"))).toEqual([
    null,
    "1",
    "1",
  ]);
  for (const url of requests)
    expect(url.searchParams.get("path")).toBe(changed);
});
