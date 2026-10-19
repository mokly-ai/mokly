/**
 * Comparison panes outside Serve, under the comparison panes contract. On the
 * copied comparison output, a pane document that cannot be presented fails
 * the comparison with Try again, and Try again presents it.
 */

import { expect } from "@playwright/test";

import { comparisonSection, paneFrame } from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton } from "./comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseViewport } from "./workspace_actions.js";

test("a pane document that cannot be presented fails and recovers with Try again", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  const generation = index.comparisonUrl.replace(/review\.json$/u, "");
  const document = `/${generation}snapshots/after/mokly-generated/${comparisonPaths.changed}/index.desktop.html`;
  // The host answers the current version's pane document with 404 once.
  allowBrowserError(responseFailure(baseURL!, document, 404));
  let failing = true;
  await page.route(`**${document}`, (route) =>
    failing
      ? route.fulfill({ status: 404, contentType: "text/plain", body: "gone" })
      : route.continue(),
  );
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await modeButton(page, "Overlay").click();
  const stage = page.locator("[data-diff-stage]");
  await expect(stage).toContainText("The comparison could not be loaded.");
  await expect(stage.locator("[data-comparison-failure] p")).toHaveText(
    "The comparison is unavailable.",
  );
  await expect(stage.locator("iframe")).toHaveCount(0);
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  failing = false;
  await stage.getByRole("button", { name: "Try again", exact: true }).click();
  const desktop = comparisonSection(page, "desktop");
  await expect(
    paneFrame(desktop, "after").contentFrame().locator("h1"),
  ).toHaveText("After screen");
  await expect(
    paneFrame(desktop, "before").contentFrame().locator("h1"),
  ).toHaveText("Before screen");
  await expect(stage).not.toHaveAttribute("aria-busy", "true");
  await expect(stage.locator("[data-comparison-failure]")).toHaveCount(0);
});
