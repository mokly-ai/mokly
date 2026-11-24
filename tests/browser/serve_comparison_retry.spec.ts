/**
 * A failed selected comparison in Serve stays in the screen and retries only
 * when the reader asks. The retry and a later refresh each request a new
 * capture, and the refresh presents new snapshots.
 */

import { expect } from "@playwright/test";

import { comparisonSection, paneFrame } from "./comparison_sections.js";
import {
  chooseMode,
  compareStage,
  comparisonFrames,
  modeButton,
} from "./comparison_ui.js";
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
  const frames = comparisonFrames(page);
  // The version before of the first frame, Desktop · Light.
  const before = paneFrame(comparisonSection(page, "desktop"), "before");
  await page.goto(`/view/${changed}/`);
  await chooseMode(page, "Overlay");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  // Inspect's head still names the screen behind the Changes tab.
  await expect(page.locator('[data-inspect-section="details"] h2')).toHaveText(
    "Changed screen",
  );
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(frames).toHaveCount(0);
  expect(requests).toHaveLength(1);

  await loadComparison(page, "Try again");
  // The stage that shows the load and then the panes keeps the focus.
  await expect(compareStage(page)).toBeFocused();
  // Overlay stacks both versions in each of the four frames.
  await expect(frames).toHaveCount(8);
  await expect(before).toHaveAttribute(PANE_SOURCE, BEFORE_SNAPSHOT);
  const retried = (await before.getAttribute(PANE_SOURCE))!;

  await loadComparison(page, "Refresh comparison");
  await expect(frames).toHaveCount(8);
  await expect(before).not.toHaveAttribute(PANE_SOURCE, retried);
  await expect(before).toHaveAttribute(PANE_SOURCE, BEFORE_SNAPSHOT);
  const refreshed = (await before.getAttribute(PANE_SOURCE))!;
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
