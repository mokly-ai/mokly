/**
 * A selected comparison in Serve omits the affected records, and a component
 * whose markup changes leaves no record on its consumer's own views. The
 * consumer's views still name the shared change, from their usage of the
 * changed component that the consumer's detail names.
 */

import { expect } from "@playwright/test";

import type { ComparisonAdditions } from "../helpers/comparison_catalogue.js";
import { write } from "../helpers/static_changes.js";

import { screenOutcomes } from "./comparison_outcomes.js";
import { comparisonSection, paneFrame } from "./comparison_sections.js";
import { chooseMode, outcomeLines } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";
import { openPanelTab } from "./workspace_actions.js";

const STAMPED = "screens/stamped";

/** Stamp changes only its markup; Stamped screen uses it and changes nothing. */
const addStamp: ComparisonAdditions = async (root, side) => {
  await write(
    root,
    "specs/components/stamp.component.html",
    `---\ntitle: Stamp\nelement: ui-stamp\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<span class="stamp">${side} stamp</span>`,
  );
  await write(
    root,
    `specs/${STAMPED}.screen.html`,
    "---\ntitle: Stamped screen\n---\n<h1>Stamped screen</h1><ui-stamp></ui-stamp>",
  );
};

test.use({ comparisonSources: { add: addStamp } });

test("a component's markup change heads its affected consumer's views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/view/${STAMPED}/`);
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await openPanelTab(page, "Changes");
  await expect(
    page.getByRole("group", { name: "Comparison mode" }),
  ).toBeVisible();
  await awaitSelectedComparison(page, () => chooseMode(page, "Side by side"));
  await expect(outcomeLines(page)).toHaveText(
    screenOutcomes("Components this screen uses changed"),
  );
  // Each version of the compared frame, Desktop · Light, holds the stamp
  // that its own commit renders.
  const pair = comparisonSection(page, "desktop");
  for (const [side, title, text] of [
    ["before", "Before", "Before stamp"],
    ["after", "Current", "After stamp"],
  ] as const) {
    const pane = paneFrame(pair, side);
    await expect(pane).toHaveAttribute("title", `${title} — desktop — light`);
    await expect(pane.contentFrame().locator(".stamp")).toHaveText(text);
  }
});
