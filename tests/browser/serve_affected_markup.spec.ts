/**
 * A selected comparison in Serve omits the affected records, and a component
 * whose markup changes leaves no record on its consumer's own views. The
 * consumer's views still name the shared change, from their usage of the
 * changed component that the consumer's detail names.
 */

import { expect } from "@playwright/test";

import type { ComparisonAdditions } from "../helpers/comparison_catalogue.js";
import { write } from "../helpers/static_changes.js";

import { modeButton } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import { awaitSelectedComparison } from "./serve_comparison_ui.js";

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
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  await awaitSelectedComparison(page, () =>
    modeButton(page, "Side by side").click(),
  );
  await expect(page.locator("[data-diff-viewport] > h3")).toHaveText([
    "Mobile · Components this screen uses changed",
    "Desktop · Components this screen uses changed",
  ]);
  // Each version holds the stamp that its own commit renders.
  for (const [title, text] of [
    ["Before", "Before stamp"],
    ["Current", "After stamp"],
  ] as const)
    await expect(
      page
        .locator(`[data-diff-stage] iframe[title^="${title} — desktop"]`)
        .contentFrame()
        .locator(".stamp"),
    ).toHaveText(text);
});
