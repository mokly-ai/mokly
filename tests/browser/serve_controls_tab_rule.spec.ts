/**
 * A compare mode shows only while the Changes tab shows it. While Overlay
 * stays chosen there, Inspect shows the current frames, so Props edits them
 * and Highlight components works. Showing Overlay again discards the edit,
 * the comparison compares the saved props, and a return to Inspect starts
 * Props again from the saved props.
 */

import { expect, type Page } from "@playwright/test";

import type { ComparisonAdditions } from "../helpers/comparison_catalogue.js";
import { write } from "../helpers/static_changes.js";

import { comparisonSection, paneFrame } from "./comparison_sections.js";
import { comparisonFrames, modeButton } from "./comparison_ui.js";
import { showProps } from "./live_props.js";
import { test } from "./serve_comparison_test.js";
import { loadComparison } from "./serve_comparison_ui.js";
import {
  canvasFrame,
  chooseViewport,
  openPanelTab,
} from "./workspace_actions.js";

const FRAMED = "screens/framed";

/**
 * Framed screen changes its body and takes a heading prop. It renders the
 * fixture's Card, so its frames hold a component to highlight.
 */
const addFramed: ComparisonAdditions = async (root, side) => {
  await write(
    root,
    `specs/${FRAMED}.screen.html`,
    `---
title: Framed screen
propSchema: {type: object, additionalProperties: false, properties: {heading: {type: string}}}
props: {heading: Saved heading}
---
<h1>{{heading}}</h1><p>${side} body</p><ui-card label="Inner card"></ui-card>`,
  );
};

test.use({ comparisonSources: { add: addFramed } });

/** The frames that draw the chosen compare mode on the canvas. */
function overlayFrames(page: Page) {
  return page.locator('[data-mokly-stage] [data-compare-mode="overlay"]');
}

/** The heading of the current version in the compared Desktop · Light frame. */
function comparedHeading(page: Page) {
  return paneFrame(comparisonSection(page, "desktop"), "after")
    .contentFrame()
    .locator("h1");
}

test("Inspect edits the current frames while Overlay stays chosen; Overlay discards the edit", async ({
  page,
}) => {
  await page.goto(`/view/${FRAMED}/`);
  await chooseViewport(page, "desktop");
  const current = page.frameLocator(canvasFrame("desktop", "light"));
  const props = await showProps(page);
  const heading = props.getByRole("textbox", { name: "heading" });
  await expect(heading).toBeEditable();

  await loadComparison(page, "Overlay");
  await expect(overlayFrames(page)).not.toHaveCount(0);
  await expect(comparedHeading(page)).toHaveText("Saved heading");

  // Overlay stays chosen in Changes, and Inspect shows the current frames.
  await openPanelTab(page, "Inspect");
  await expect(comparisonFrames(page)).toHaveCount(0);
  await expect(overlayFrames(page)).toHaveCount(0);
  await expect(current.locator("h1")).toHaveText("Saved heading");
  const highlight = page.getByRole("switch", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeEnabled();
  await highlight.check();
  await expect(highlight).toBeChecked();
  await highlight.uncheck();
  await expect(heading).toBeEditable();
  await heading.fill("Edited heading");
  await expect(current.locator("h1")).toHaveText("Edited heading");

  // Changes shows Overlay again, which compares the saved props.
  await openPanelTab(page, "Changes");
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(overlayFrames(page)).not.toHaveCount(0);
  await expect(comparedHeading(page)).toHaveText("Saved heading");

  // The edit went with the comparison: Props starts from the saved props.
  await openPanelTab(page, "Inspect");
  await expect(comparisonFrames(page)).toHaveCount(0);
  await expect(heading).toBeEditable();
  await expect(heading).toHaveValue("Saved heading");
  await expect(current.locator("h1")).toHaveText("Saved heading");
});
