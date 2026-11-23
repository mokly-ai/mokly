/**
 * A failed selected comparison in Serve returns to Current on a watched
 * update without requesting another comparison; the next explicit diff
 * selection requests one against the new state.
 */

import { expect } from "@playwright/test";

import { comparisonSection, paneFrame } from "./comparison_sections.js";
import {
  chooseMode,
  compareState,
  modeButton,
  navRow,
} from "./comparison_ui.js";
import {
  consumerSource,
  consumerTitled,
  CONSUMER_SOURCE,
} from "./serve_changes_emulation.js";
import { test } from "./serve_comparison_test.js";
import {
  loadComparison,
  selectedRequests,
  SELECTED_ENDPOINT,
} from "./serve_comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { canvasFrame } from "./workspace_actions.js";

test("a watched update resets failed diffs to Current without generating", async ({
  page,
  changes,
  allowBrowserError,
}) => {
  const changed = changes.paths.changed;
  const failing = `${SELECTED_ENDPOINT}?path=${encodeURIComponent(changed)}`;
  allowBrowserError(responseFailure(changes.url, failing, 503));
  // One temporary comparison failure, as Serve answers a capture it cannot finish.
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
  await page.goto(`/view/${changed}/?viewport=desktop`);
  await chooseMode(page, "Overlay");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);

  await changes.edit(
    CONSUMER_SOURCE,
    consumerSource("Consumer renamed"),
    consumerTitled("Consumer renamed"),
  );
  await expect(navRow(page, changes.paths.consumer)).toContainText(
    "Consumer renamed",
  );
  await expect(modeButton(page, "Current")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // The failure left the canvas, which shows the live frames again.
  await expect(compareState(page)).toBeHidden();
  await expect(page.locator(canvasFrame("desktop"))).toBeVisible();
  expect(requests).toHaveLength(1);

  await loadComparison(page, "Overlay");
  await expect(
    paneFrame(comparisonSection(page, "desktop"), "after")
      .contentFrame()
      .locator("h1"),
  ).toHaveText("After screen");
  expect(requests).toHaveLength(2);
});
