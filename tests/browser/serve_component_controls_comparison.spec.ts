/**
 * Temporary prop edits in Serve keep the last valid preview through a failed
 * and a superseded render, and selecting a comparison restores the saved
 * props: the comparison that the Changes tab shows compares them, Inspect,
 * which shows the current frames, offers their editable controls without a
 * comparison line, and Current shows the saved props again.
 */

import { expect, type Route } from "@playwright/test";

import { chooseMode } from "./comparison_ui.js";
import { showProps } from "./live_props.js";
import { isRender, renderBody } from "./live_shell_fixture.js";
import { test } from "./serve_comparison_test.js";
import { expectCardPane, loadComparison } from "./serve_comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import {
  canvasFrame,
  chooseViewport,
  openPanelTab,
} from "./workspace_actions.js";

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
  // The edited row of the variant set: the card's own example, whose Light
  // and Dark frames each render the edit.
  const row = (scheme: "dark" | "light") =>
    page.frameLocator(
      `${canvasFrame("desktop", scheme)}[data-workspace-variant="${changes.paths.component}"]`,
    );
  const preview = row("light");
  await label.fill("Valid");
  await expect(preview.locator("h2")).toHaveText("Valid");
  await expect(row("dark").locator("h2")).toHaveText("Valid");

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
  // One render for each frame of the row.
  await expect.poll(() => held.length).toBe(2);
  // The edit status sits outside the busy preview, beside the stage.
  await expect(page.locator(".mbk-edit-status")).toContainText(
    "Updating preview",
  );
  await label.fill("Newest");
  await expect.poll(() => aborted).toEqual(["Hang", "Hang"]);
  await expect(preview.locator("h2")).toHaveText("Newest");

  await loadComparison(page, "Overlay");
  // The edited row's Light frame compares the saved props: its Current
  // version shows the saved label and the current commit's `.accent` colour.
  // The canvas shows the mode while the Changes tab is selected.
  await expectCardPane(page, "after", "Card content", "light", "Card");
  // Inspect shows the current frames, and Props edits them: its controls show
  // the saved props that the comparison restored, without a comparison line.
  await openPanelTab(page, "Inspect");
  await expect(label).toBeEditable();
  await expect(label).toHaveValue("Card content");
  await expect(preview.locator("h2")).toHaveText("Card content");
  await expect(
    props.getByText("Comparisons show the saved props.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    props.getByRole("button", { name: "Switch to Current", exact: true }),
  ).toHaveCount(0);

  await chooseMode(page, "Current");
  await openPanelTab(page, "Inspect");
  await expect(label).toBeEditable();
  await expect(label).toHaveValue("Card content");
  await expect(preview.locator("h2")).toHaveText("Card content");
});
