/**
 * React stylesheet Details and screen inspection on a small comparison copy,
 * under the CSS evidence presentation contract. `addReactEvidenceSources`
 * adds a React group to the default catalogue: one module whose imported
 * sheet changes a Button rule and Checkout's heading rule, a Badge and its
 * consumer whose only change is a rule on the renderer's wrapper, and a Home
 * screen with nested, repeated and hidden Button instances.
 */

import { expect, type Page } from "@playwright/test";

import {
  addReactEvidenceSources,
  reactEvidencePaths as paths,
  reactEvidenceStylesheets as sheets,
} from "../helpers/react_evidence_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";
import {
  COMPONENT_FILES_LEAD,
  INSPECTOR_VIEWPORTS,
  MATCHED_LEAD,
  SAVED_VIEW_LEAD,
  SHARED,
  VARIANT_TERMINAL,
  evidenceFiles,
  openEvidence,
} from "./comparison_evidence_page.js";
import { chooseFilter, navRow } from "./comparison_ui.js";

const test = additionsCopyTest(
  "browser-react-evidence",
  addReactEvidenceSources,
);

/**
 * The Usage panel lists `usedBy` as consumers, and none of them as affected:
 * a wrapper rule on a consumer's own document is the consumer's own change.
 */
async function expectUsersNotAffected(
  page: Page,
  usedBy: readonly string[],
): Promise<void> {
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage).toBeVisible();
  await expect(
    usage.locator('[data-usage-section="used-by"]').getByRole("link"),
  ).toHaveText([...usedBy]);
  await expect(usage.locator('[data-usage-section="affected"]')).toHaveCount(0);
  await expect(usage).not.toContainText("Affected screens");
}

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} React stylesheet evidence`, () => {
    test.use({ viewport: size });

    test("bundled CSS names the emitted file and keeps component-only styles out", async ({
      page,
    }) => {
      await page.goto(`/view/${paths.checkout}/`);
      const evidence = await openEvidence(page);
      await expect
        .poll(() => evidenceFiles(evidence))
        .toEqual([[sheets.bundle, [[MATCHED_LEAD, [".heading"]]]]]);
      await expect(evidence.locator("code.mbk-code")).toHaveText([".heading"]);
      await expect(evidence).not.toContainText("react/rule.css");
    });

    test("a wrapper-only saved view row names its own styles and no consumers", async ({
      page,
    }) => {
      for (const route of [paths.badgeVariant, paths.badge]) {
        await page.goto(`/view/${route}/`);
        const evidence = await openEvidence(page);
        await expect(
          evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
        ).toBeVisible();
        await expect
          .poll(() => evidenceFiles(evidence))
          .toEqual([[sheets.wrapper, [[SAVED_VIEW_LEAD, [".frame"]]]]]);
        await expect(evidence).not.toContainText(SHARED);
        await expect(evidence).not.toContainText(VARIANT_TERMINAL);
        await expectUsersNotAffected(page, ["Badged"]);
      }
    });
  });
}

test("screen inspection records real nested, repeated and hidden instances without listing the screen in Changes", async ({
  page,
}) => {
  await page.goto(`/view/${paths.home}/`);
  // Its Button instances changed, but the screen has no Changes row.
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(navRow(page, paths.home)).not.toHaveAttribute("data-changed");
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Components", exact: true }),
  ).toContainText("5 instances");
  const highlight = page.getByRole("button", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeEnabled();
  await highlight.click();
  await expect(
    page.locator('.mbk-highlight-layer[data-highlight-viewport="desktop"]'),
  ).toBeVisible();
  await expect(
    page.locator(".mbk-highlight-label").filter({ hasText: "hidden" }),
  ).toHaveCount(0);
  await page
    .locator(".mbk-highlight-label")
    .filter({ hasText: "footer" })
    .first()
    .click();
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("Finish");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(highlight).toBeFocused();
  await chooseFilter(page, "changed");
  await expect(navRow(page, paths.home)).toBeHidden();
  await expect(navRow(page, paths.button)).toBeVisible();
  await page.getByRole("link", { name: "Open component", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Button", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
});
