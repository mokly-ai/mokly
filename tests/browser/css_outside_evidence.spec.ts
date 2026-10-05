import { expect, test, type Page } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";
import {
  COMPONENT_FILES_LEAD,
  COMPONENT_LEAD,
  FILES_LEAD,
  INSPECTOR_VIEWPORTS,
  MATCHED_LEAD,
  OUTSIDE_LEAD,
  SAVED_VIEW_UNRESOLVED_LEAD,
  UNRESOLVED_LEAD,
  VARIANT_TERMINAL,
  evidenceFiles,
  evidenceSpacing,
  openEvidence,
} from "./css_evidence_page.js";
import { cssOutsideFixture } from "./css_outside_fixture.js";

const RULES = "mockups/rule.css";
/** The branch-point sentence of a catalogue that Serve compares with `main`. */
const SERVED_BASE = "Compared with the branch point on main.";
/** The public bundle that carries CSS imported by the entry module. */
const BUNDLE = "mockups/mokly-generated/styles/entries/fixture.mockup.tsx.css";

let outside: Awaited<ReturnType<typeof cssOutsideFixture>>;
let bundled: Awaited<ReturnType<typeof cssOutsideFixture>>;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  outside = await cssOutsideFixture({
    css: ".action, .heading { color: blue; }\n.heading { --tone: red; }\n",
    changed: 4,
  });
  bundled = await cssOutsideFixture({
    css: ".action { color: blue; }\n.heading { color: blue; }\n",
    changed: 3,
    delivery: "javascript",
  });
});
test.afterAll(async () => {
  await outside?.close();
  await bundled?.close();
});

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} outside-component evidence`, () => {
    test.use({ viewport: size });

    test("a screen names outside matches and keeps its unresolved paragraph", async ({
      page,
    }) => {
      await page.goto(`${outside.url}/view/checkout/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(evidence.locator("p").first()).toHaveText(SERVED_BASE);
      await expect(
        evidence.getByText(FILES_LEAD, { exact: true }),
      ).toBeVisible();
      expect(await evidenceFiles(evidence)).toEqual([
        [
          RULES,
          [
            [OUTSIDE_LEAD, [".heading"]],
            [UNRESOLVED_LEAD, [".heading"]],
          ],
        ],
      ]);
      expect(await evidenceSpacing(evidence)).toMatchObject({
        sentence: "8px",
        styles: "8px",
        afterList: "14px",
      });
      await expect(
        evidence.getByRole("link", { name: "Action", exact: true }),
      ).toBeVisible();
      await expect(evidence).not.toContainText(/[0-9a-f]{64}/);
      await expect(page.locator(".mbk-screen-head")).not.toContainText(
        ".heading",
      );
    });

    test("the changed component keeps its own sentence beside its saved view's", async ({
      page,
    }) => {
      await page.goto(`${outside.url}/view/action/default/`);
      const evidence = await openEvidence(page);
      await expect(evidence.locator("p").first()).toHaveText(SERVED_BASE);
      await expect(
        evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
      ).toBeVisible();
      expect(await evidenceFiles(evidence)).toEqual([
        [
          RULES,
          [
            [COMPONENT_LEAD, [".action", ".heading"]],
            [SAVED_VIEW_UNRESOLVED_LEAD, [".heading"]],
          ],
        ],
      ]);
      await expect(evidence).not.toContainText(VARIANT_TERMINAL);
    });

    test("the shell repeats the approved mockup's layout and copy", async ({
      page,
    }) => {
      await page.goto(`${outside.url}/view/checkout/`);
      const served = await evidenceFiles(await openEvidence(page));
      const servedSpacing = await evidenceSpacing(
        page.locator("[data-workspace-evidence]"),
      );
      await page.goto(
        componentDesignUrl(
          "design/components/states/shared-impact/style-outside",
          name,
        ),
      );
      const card = page.locator(".ce-comparison-evidence");
      const [[, [approved]]] = (await evidenceFiles(card)) as [
        [string, [[string, string[]]]],
      ];
      expect(served[0]?.[1][0]?.[0]).toBe(approved?.[0]);
      await expect(card.getByText(FILES_LEAD, { exact: true })).toBeVisible();
      expect(await nestedSpacing(page)).toEqual({
        sentence: servedSpacing.sentence,
        styles: servedSpacing.styles,
      });
    });

    test("bundled CSS names the emitted file and keeps component-only styles out", async ({
      page,
    }) => {
      await page.goto(`${bundled.url}/view/checkout/`);
      const evidence = await openEvidence(page);
      expect(await evidenceFiles(evidence)).toEqual([
        [BUNDLE, [[MATCHED_LEAD, [".heading"]]]],
      ]);
      await expect(evidence.locator("code.mbk-code")).toHaveText([".heading"]);
      await expect(evidence).not.toContainText("entries/rule.css");
    });

    test("a consuming component shows its styles in Current before any comparison", async ({
      page,
    }) => {
      await page.goto(`${bundled.url}/view/toolbar/`);
      const evidence = await openEvidence(page);
      expect(await evidenceFiles(evidence)).toEqual([
        [BUNDLE, [[COMPONENT_LEAD, [".action"]]]],
      ]);
      await expect(evidence).toContainText(
        "Shared component changes affect this preview.",
      );
      await expect(evidence).not.toContainText(VARIANT_TERMINAL);
      await expect(page.locator(".mbk-diff-view")).toHaveCount(0);
    });
  });
}

test.describe("outside evidence across modes and filters", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Current, a loaded comparison and Changes show the same facts once", async ({
    page,
  }) => {
    await page.goto(`${outside.url}/view/checkout/`);
    const evidence = await openEvidence(page);
    const facts = await evidenceFiles(evidence);
    await page
      .getByRole("button", { name: "Side by side", exact: true })
      .click();
    await expect(page.locator(".mbk-diff-view").first()).toBeVisible();
    expect(await evidenceFiles(evidence)).toEqual(facts);
    await expect(evidence.getByText(OUTSIDE_LEAD, { exact: true })).toHaveCount(
      1,
    );
    await page.getByRole("button", { name: "Current", exact: true }).click();
    expect(await evidenceFiles(evidence)).toEqual(facts);
    await page.locator('[data-filter="changed"]').click();
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("4");
    expect(await evidenceFiles(evidence)).toEqual(facts);
  });
});

/** The mockup card's nested sentence and style list spacing. */
function nestedSpacing(page: Page) {
  return page.locator(".mbk-evidence-files").evaluate((list: Element) => {
    const item = list.querySelector(":scope > li");
    const margin = (selector: string) => {
      const element = item?.querySelector(selector);
      return element ? getComputedStyle(element).marginTop : "";
    };
    return {
      sentence: margin(":scope > p"),
      styles: margin(":scope > ul"),
    };
  });
}
