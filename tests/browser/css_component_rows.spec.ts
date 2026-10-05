import { expect, test, type Page } from "@playwright/test";

import {
  COMPONENT_FILES_LEAD,
  INSPECTOR_VIEWPORTS,
  MATCHED_LEAD,
  SAVED_VIEW_LEAD,
  VARIANT_TERMINAL,
  evidenceFiles,
  openCatalogue,
  openEvidence,
} from "./css_evidence_page.js";
import { cssOutsideFixture } from "./css_outside_fixture.js";

const RULES = "mockups/rule.css";
const SHARED = "Shared component changes affect this preview.";

let wrapper: Awaited<ReturnType<typeof cssOutsideFixture>>;
let componentOnly: Awaited<ReturnType<typeof cssOutsideFixture>>;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  wrapper = await cssOutsideFixture({
    css: ".frame { color: blue; }\n",
    changed: 3,
  });
  componentOnly = await cssOutsideFixture({
    css: ".action { color: blue; }\n",
    changed: 2,
  });
});
test.afterAll(async () => {
  await wrapper?.close();
  await componentOnly?.close();
});

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} component stylesheet rows`, () => {
    test.use({ viewport: size });

    test("a wrapper-only saved view row names its own styles and no consumers", async ({
      page,
    }) => {
      for (const route of ["action/default", "action"]) {
        await page.goto(`${wrapper.url}/view/${route}/`);
        const evidence = await openEvidence(page);
        await expect(
          evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
        ).toBeVisible();
        expect(await evidenceFiles(evidence)).toEqual([
          [RULES, [[SAVED_VIEW_LEAD, [".frame"]]]],
        ]);
        await expect(evidence).not.toContainText(SHARED);
        await expect(evidence).not.toContainText(VARIANT_TERMINAL);
        await expectNoAffectedConsumers(page);
      }
    });

    test("an affected-only screen keeps its full styles without a row of its own", async ({
      page,
    }) => {
      await page.goto(`${componentOnly.url}/view/checkout/`);
      const evidence = await openEvidence(page);
      expect(await evidenceFiles(evidence)).toEqual([
        [RULES, [[MATCHED_LEAD, [".action"]]]],
      ]);
      await expect(evidence).toContainText(SHARED);
      await expect(
        evidence.getByRole("link", { name: "Action", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".mbk-nav-filter-count")).toHaveText("2");
      await openCatalogue(page, name);
      await page.locator('[data-filter="changed"]').click();
      await expect(
        page.locator('[data-route="checkout/index.html"]'),
      ).toBeHidden();
      await expect(
        page.locator('[data-route="action/index.html"]'),
      ).toBeVisible();
    });
  });
}

/** The Usage panel lists no Affected screens or components. */
async function expectNoAffectedConsumers(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage).toBeVisible();
  await expect(usage.locator('[data-usage-section="affected"]')).toHaveCount(0);
  await expect(usage).not.toContainText("Affected screens");
}
