/**
 * Screen stylesheet evidence on the copied comparison output, under the CSS
 * evidence shell and attribution contracts, at both inspector sizes. A
 * changed selector-less at-rule is named by its at-rule and prelude, and its
 * file keeps the screen in Changes. A changed rule that matches only the
 * mobile view names its style, and the desktop view's comparison reads as
 * unchanged.
 */

import { expect } from "@playwright/test";

import { configuredStylesheets as sheets } from "../helpers/comparison_evidence_groups.js";

import {
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  INSPECTOR_VIEWPORTS,
  MATCHED_LEAD,
  UNNAMED_LEAD,
  UNRESOLVED_LEAD,
  evidenceFiles,
  evidenceSpacing,
  openEvidence,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { modeButton } from "./comparison_ui.js";

/** Pane headings fixed by docs/protocol/mokly-css-evidence-shell.md. */
const STYLE_HEADING = "Styles this screen uses changed";
const UNCHANGED_HEADING = "No changes to this screen";

for (const [name, size] of INSPECTOR_VIEWPORTS)
  test.describe(`${name} screen evidence`, () => {
    test.use({ viewport: size });

    test("a selector-less at-rule change names its at-rule and keeps the screen in Changes", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.atRuleChange}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(UNRESOLVED_LEAD, { exact: true }),
      ).toBeVisible();
      expect(await evidenceFiles(evidence)).toEqual([
        [sheets.fade, [[UNRESOLVED_LEAD, ["@keyframes fixture-fade"]]]],
      ]);
      await expect(evidence.locator("code.mbk-code")).toHaveText([
        "@keyframes fixture-fade",
      ]);
      for (const lead of [UNNAMED_LEAD, MATCHED_LEAD, EXCLUDED_LEAD])
        await expect(evidence.getByText(lead, { exact: true })).toHaveCount(0);
      expect(await evidenceSpacing(evidence)).toMatchObject({
        paragraph: "8px",
        list: "8px",
        sentence: "8px",
      });
    });

    test("a released viewport reads as unchanged beside a retained one", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.mobileOnlyChange}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(MATCHED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
      for (const lead of [EXCLUDED_LEAD, EXAMINED_LEAD])
        await expect(evidence).not.toContainText(lead);
      await modeButton(page, "Side by side").click();
      await expect(page.locator(".mbk-diff-view h3")).toHaveText([
        `Mobile · ${STYLE_HEADING}`,
        `Desktop · ${UNCHANGED_HEADING}`,
      ]);
    });
  });
