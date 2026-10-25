import { expect } from "@playwright/test";

import { parseReviewResult } from "../../packages/viewer/src/review/result_validation.js";

import { showMode } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import { expectCardPane } from "./serve_comparison_ui.js";

test("Serve opens Overlay for the Card variant with parent-owned stylesheet evidence", async ({
  page,
  changes,
}) => {
  await page.goto(`/view/${changes.paths.changedVariant}/?viewport=desktop`);
  const [selected] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/generations/selected-") &&
        response.url().endsWith("/review.json") &&
        response.request().method() === "GET",
    ),
    showMode(page, "Overlay"),
  ]);
  expect(selected.ok()).toBe(true);
  const review = parseReviewResult(await selected.json());
  expect(review.entries.map((entry) => entry.path)).toEqual([
    changes.paths.component,
  ]);
  const variants = review.entries[0]!.variants!;
  expect(variants.map((entry) => entry.path)).toEqual([
    changes.paths.changedVariant,
  ]);
  expect(variants[0]!.reasons).toContainEqual({
    kind: "dependency",
    path: "static/mokly-generated/styles/theme.css",
  });
  expect(variants[0]!.views[0]!.rules).toContainEqual({
    stylesheet: "static/mokly-generated/styles/theme.css",
    selector: ".accent",
    status: "matched",
    owner: { kind: "component", path: changes.paths.component },
  });
  for (const [pane, title] of [
    ["before", "Before"],
    ["after", "Current"],
  ] as const)
    await expect(page.locator(`.mb-pane--${pane} iframe`)).toHaveAttribute(
      "title",
      `${title} — desktop — light`,
    );
  await expectCardPane(page, "before", "Featured Before");
  await expectCardPane(page, "after", "Featured After");
  await expect(page.locator("[data-comparison-failure]")).toHaveCount(0);
});
