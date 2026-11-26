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
  DESKTOP_INSPECTOR,
  MATCHED_LEAD,
  VARIANT_LEAD,
  SHARED,
  VARIANT_TERMINAL,
  evidenceFiles,
  openChangesEvidence,
} from "./comparison_evidence_page.js";
import { chooseFilter, navRow } from "./comparison_ui.js";
import { openInspectFold, zoomToTags } from "./workspace_actions.js";

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
  const usage = await openInspectFold(page, "usage");
  await expect(usage).toBeVisible();
  await expect(
    usage.locator('[data-usage-section="used-by"]').getByRole("link"),
  ).toHaveText([...usedBy]);
  await expect(usage.locator('[data-usage-section="affected"]')).toHaveCount(0);
  await expect(usage).not.toContainText("Affected screens");
}

test.describe("desktop React stylesheet evidence", () => {
  test.use({ viewport: DESKTOP_INSPECTOR });

  test("bundled CSS names the emitted file and keeps component-only styles out", async ({
    page,
  }) => {
    await page.goto(`/view/${paths.checkout}/`);
    const evidence = await openChangesEvidence(page);
    await expect
      .poll(() => evidenceFiles(evidence))
      .toEqual([[sheets.bundle, [[MATCHED_LEAD, [".heading"]]]]]);
    await expect(evidence.locator("code.mbk-code")).toHaveText([".heading"]);
    await expect(evidence).not.toContainText("react/rule.css");
  });

  test("a wrapper-only saved view row names its own styles and no affected consumers", async ({
    page,
  }) => {
    for (const route of [paths.badgeVariant, paths.badge]) {
      await page.goto(`/view/${route}/`);
      const evidence = await openChangesEvidence(page);
      await expect(
        evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => evidenceFiles(evidence))
        .toEqual([[sheets.wrapper, [[VARIANT_LEAD, [".frame"]]]]]);
      await expect(evidence).not.toContainText(SHARED);
      await expect(evidence).not.toContainText(VARIANT_TERMINAL);
      await expectUsersNotAffected(page, ["Badged"]);
    }
  });
});

test("screen inspection records real nested, repeated and hidden instances without listing the screen in Changes", async ({
  page,
}) => {
  await page.goto(`/view/${paths.home}/`);
  // Its Button instances changed, but the screen has no Changes row.
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(navRow(page, paths.home)).not.toHaveAttribute("data-changed");
  await expect(await openInspectFold(page, "components")).toContainText(
    "5 instances",
  );
  // The switch stands in Inspect's Frames filter.
  const highlight = page.getByRole("switch", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeEnabled();
  await highlight.click();
  // The switch draws on every shown frame: on the canvas, each scheme's.
  await expect(
    page
      .locator('.mbk-highlight-layer[data-highlight-viewport="desktop"]')
      .first(),
  ).toBeVisible();
  await expect(
    page.locator(".mbk-highlight-label").filter({ hasText: "hidden" }),
  ).toHaveCount(0);
  // Below 60% zoom the labels hide, so the canvas zooms in first. The labels
  // keep their size over scaled frames, so a neighbour's label can cover
  // this one; the keys press it.
  await zoomToTags(page);
  const footer = page
    .locator(".mbk-highlight-label")
    .filter({ hasText: "footer" })
    .first();
  await footer.focus();
  await page.keyboard.press("Enter");
  // Inspect's Selection section lists the props that the selected
  // instance's owner supplies.
  const selection = page.locator('[data-inspect-section="selection"]');
  await expect(selection).toContainText("Finish");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(highlight).toBeFocused();
  await chooseFilter(page, "changed");
  await expect(navRow(page, paths.home)).toBeHidden();
  await expect(navRow(page, paths.button)).toBeVisible();
  // The selection's chip opens the instance's component.
  await selection.getByRole("link", { name: "Button", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Button", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
});
