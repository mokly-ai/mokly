/**
 * Details in an embedded viewer over the copied comparison output, under the
 * CSS evidence shell contract. The host supplies a public index without
 * `base`, so Details keep the "Comparison details" heading and the rest of
 * the evidence and show no branch-point sentence, and the Compared rail names
 * the branch point alone. One journey checks this wiring at the desktop
 * inspector size: a variant in Changes, then a screen that the reader
 * reaches by navigation. Unit tests of `@mokly/ui` and of the viewer cover
 * the heading and the rail for each kind of entry.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { configuredStylesheets as sheets } from "../helpers/comparison_evidence_groups.js";

import {
  DESKTOP_INSPECTOR,
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  SCREEN_TERMINAL,
  expectExcludedOnly,
  openChangesEvidence,
  openEvidence,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { navRow } from "./comparison_ui.js";
import {
  comparisonViewerHost,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";
import { inspectTitle } from "./inspect_head.js";

let host: ComparisonViewerHost;
test.beforeAll(async () => {
  host = await comparisonViewerHost();
});
test.afterAll(async () => {
  await host?.close();
});

/**
 * Mount the viewer over an index without `base` and open the Changes tab of
 * `entry`, whose Details have no branch-point sentence and whose Compared
 * rail names the branch point alone.
 */
async function embeddedChanges(page: Page, entry: string): Promise<Locator> {
  await page.goto(
    `${host.url}/viewer.html?adapter=same-origin&base=none&responsive=1&entry=${entry}`,
  );
  return openChangesEvidence(page, null);
}

/** The excluded stylesheet of screens/stable, without the base sentence. */
async function expectScreenDetails(evidence: Locator): Promise<void> {
  await expectExcludedOnly(
    evidence,
    [EXCLUDED_LEAD, EXAMINED_LEAD, SCREEN_TERMINAL],
    [sheets.theme],
  );
}

test.describe("desktop embedded Details", () => {
  test.use({ viewport: DESKTOP_INSPECTOR });

  test("an embedded screen reached by navigation stays without the branch-point sentence", async ({
    page,
  }) => {
    await embeddedChanges(page, comparisonPaths.quietParent);
    await navRow(page, comparisonPaths.unchanged).click();
    await expect(inspectTitle(page.locator("#viewer"))).toHaveText(
      "Stable screen",
    );
    await expectScreenDetails(await openEvidence(page, null));
  });
});
