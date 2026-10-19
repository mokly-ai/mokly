/**
 * Details in an embedded viewer over the copied comparison output, under the
 * CSS evidence shell contract. The host supplies a public index without
 * `base`, so Details keep the "Comparison details" heading and the rest of
 * the evidence and show no branch-point sentence: for a screen, for a saved
 * view, and for a screen that the reader reaches by navigation, at both
 * inspector sizes.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { navRow } from "./comparison_ui.js";
import {
  comparisonViewerHost,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";

/** Inspector copy fixed by docs/protocol/mokly-css-evidence-shell.md. */
const BRANCH_POINT = "Compared with the branch point";
const EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this screen.";
const VARIANT_EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this variant.";
const EXAMINED_LEAD = "Examined and excluded:";
const SCREEN_TERMINAL = "No changes to this screen.";
const VARIANT_TERMINAL = "No changes to this saved view.";
const THEME = "static/mokly-generated/styles/theme.css";
const INSPECTOR_VIEWPORTS = [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const;

let host: ComparisonViewerHost;
test.beforeAll(async () => {
  host = await comparisonViewerHost();
});
test.afterAll(async () => {
  await host?.close();
});

/** Open the Details tab and return the comparison details it reveals. */
async function openDetails(page: Page): Promise<Locator> {
  const tab = page.getByRole("tab", { name: "Details", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const evidence = page.locator("#viewer [data-workspace-evidence]");
  await expect(evidence).toBeVisible();
  await expect(evidence.locator("h3")).toHaveText(["Comparison details"]);
  return evidence;
}

/** Mount the viewer over an index without `base` and open its Details. */
async function embeddedDetails(page: Page, entry: string): Promise<Locator> {
  await page.goto(
    `${host.url}/viewer.html?adapter=same-origin&base=none&responsive=1&entry=${entry}`,
  );
  return openDetails(page);
}

/** The excluded stylesheet of screens/stable, without the base sentence. */
async function expectScreenDetails(evidence: Locator): Promise<void> {
  await expect(evidence.locator("p")).toHaveText([
    EXCLUDED_LEAD,
    EXAMINED_LEAD,
    SCREEN_TERMINAL,
  ]);
  await expect(evidence.locator("ul > li")).toHaveText([THEME]);
  await expect(evidence).not.toContainText(BRANCH_POINT);
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
      await expect((await openDetails(page)).locator("p").first()).toHaveText(
        `${BRANCH_POINT} on fixture-base.`,
      );
    });

    test("an embedded saved view keeps its Details without the branch-point sentence", async ({
      page,
    }) => {
      const evidence = await embeddedDetails(page, comparisonPaths.quietParent);
      await expect(evidence.locator("p")).toHaveText([
        VARIANT_EXCLUDED_LEAD,
        EXAMINED_LEAD,
        VARIANT_TERMINAL,
      ]);
      await expect(evidence.locator("ul > li")).toHaveText([THEME]);
      await expect(evidence).not.toContainText(BRANCH_POINT);
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
      await expectScreenDetails(await openDetails(page));
    });
  });
