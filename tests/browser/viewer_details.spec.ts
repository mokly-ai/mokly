/**
 * Details in an embedded viewer over the copied comparison output, under the
 * CSS evidence shell contract. The host supplies a public index without
 * `base`, so Details keep the "Comparison details" heading and the rest of
 * the evidence and show no branch-point sentence: for a screen, for a saved
 * view, and for a screen that the reader reaches by navigation, at both
 * inspector sizes.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { configuredStylesheets as sheets } from "../helpers/comparison_evidence_groups.js";

import {
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  INSPECTOR_VIEWPORTS,
  SCREEN_TERMINAL,
  VARIANT_EXCLUDED_LEAD,
  VARIANT_TERMINAL,
  expectExcludedOnly,
  openEvidence,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { navRow } from "./comparison_ui.js";
import {
  comparisonViewerHost,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";

let host: ComparisonViewerHost;
test.beforeAll(async () => {
  host = await comparisonViewerHost();
});
test.afterAll(async () => {
  await host?.close();
});

/**
 * Mount the viewer over an index without `base` and open its Details, which
 * have no branch-point sentence.
 */
async function embeddedDetails(page: Page, entry: string): Promise<Locator> {
  await page.goto(
    `${host.url}/viewer.html?adapter=same-origin&base=none&responsive=1&entry=${entry}`,
  );
  return openEvidence(page, null);
}

/** The excluded stylesheet of screens/stable, without the base sentence. */
async function expectScreenDetails(evidence: Locator): Promise<void> {
  await expectExcludedOnly(
    evidence,
    [EXCLUDED_LEAD, EXAMINED_LEAD, SCREEN_TERMINAL],
    [sheets.theme],
  );
}

for (const [name, size] of INSPECTOR_VIEWPORTS)
  test.describe(`${name} embedded Details`, () => {
    test.use({ viewport: size });

    test("an embedded screen keeps its Details without the branch-point sentence", async ({
      page,
    }) => {
      await expectScreenDetails(
        await embeddedDetails(page, comparisonPaths.unchanged),
      );
      // The same viewer over the index with its base shows the sentence.
      await page.goto(
        `${host.url}/viewer.html?adapter=same-origin&responsive=1&entry=${comparisonPaths.unchanged}`,
      );
      await openEvidence(page);
    });

    test("an embedded saved view keeps its Details without the branch-point sentence", async ({
      page,
    }) => {
      await expectExcludedOnly(
        await embeddedDetails(page, comparisonPaths.quietParent),
        [VARIANT_EXCLUDED_LEAD, EXAMINED_LEAD, VARIANT_TERMINAL],
        [sheets.theme],
      );
    });

    test("an embedded screen reached by navigation stays without the branch-point sentence", async ({
      page,
    }) => {
      await embeddedDetails(page, comparisonPaths.quietParent);
      if (name === "mobile")
        await page
          .getByRole("button", { name: "Open catalogue navigation" })
          .click();
      await navRow(page, comparisonPaths.unchanged).click();
      await expect(page.locator("#viewer .mbk-screen-head h2")).toHaveText(
        "Stable screen",
      );
      await expectScreenDetails(await openEvidence(page, null));
    });
  });
