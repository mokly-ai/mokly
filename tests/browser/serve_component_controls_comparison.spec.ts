/**
 * Temporary prop edits in Serve keep the last valid preview through a failed
 * and a superseded render, and selecting a comparison restores the saved
 * props: the comparison shows them, the controls stay unavailable, and
 * Current shows the saved props again.
 */

import { expect, type Route } from "@playwright/test";

import { modeButton } from "./comparison_ui.js";
import { showProps } from "./live_props.js";
import { isRender, renderBody } from "./live_shell_fixture.js";
import { test } from "./serve_comparison_test.js";
import { loadComparison } from "./serve_comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseViewport } from "./workspace_actions.js";

test("failed and superseded edits keep the last valid preview; comparisons restore saved props", async ({
  page,
  changes,
  allowBrowserError,
}) => {
  allowBrowserError(
    responseFailure(changes.url, "/mokly-viewer/components/render", 422),
  );
  await page.goto(`/view/${changes.paths.component}/`);
  await chooseViewport(page, "desktop");
  const props = await showProps(page);
  const label = props.getByRole("textbox", { name: "label" });
  await expect(label).toBeEditable();
  const preview = page.frameLocator('[data-workspace-frame="desktop"]');
  await label.fill("Valid");
  await expect(preview.locator("h2")).toHaveText("Valid");

  const held: Route[] = [];
  await page.route("**/mokly-viewer/components/render", async (route) => {
    const value = renderBody(route.request()).label;
    if (value === "Fail")
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ code: "render-failed", message: "failed" }),
      });
    else if (value === "Hang") held.push(route);
    else await route.continue();
  });
  await label.fill("Fail");
  await expect(props.getByRole("alert")).toContainText(
    "The preview could not be updated",
  );
  await expect(preview.locator("h2")).toHaveText("Valid");
  const aborted: unknown[] = [];
  page.on("requestfailed", (request) => {
    if (isRender(request)) aborted.push(renderBody(request).label);
  });
  await label.fill("Hang");
  await expect.poll(() => held.length).toBe(1);
  // The edit status sits outside the busy preview, beside the stage.
  await expect(page.locator(".mbk-edit-status")).toContainText(
    "Updating preview",
  );
  await label.fill("Newest");
  await expect.poll(() => aborted).toEqual(["Hang"]);
  await expect(preview.locator("h2")).toHaveText("Newest");

  await loadComparison(page, "Overlay");
  await expect(
    props.getByText("Comparisons show the saved props.", { exact: true }),
  ).toBeVisible();
  await expect(
    props.getByRole("button", { name: "Switch to Current", exact: true }),
  ).toBeVisible();
  await expect(props.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator("h2"),
  ).toHaveText("Card content");

  await modeButton(page, "Current").click();
  await expect(label).toBeEditable();
  await expect(label).toHaveValue("Card content");
  await expect(preview.locator("h2")).toHaveText("Card content");
});
