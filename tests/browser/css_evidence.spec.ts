import { expect, test } from "@playwright/test";

import { cssEvidenceFixture } from "./css_evidence_fixture.js";
import {
  CHANGED_HEADING,
  EXCLUDED_LEAD,
  FILES_LEAD,
  INSPECTOR_VIEWPORTS,
  MATCHED_LEAD,
  SCREEN_TERMINAL,
  STYLESHEET,
  UNRESOLVED_LEAD,
  VARIANT_TERMINAL,
  evidenceSpacing,
  openCatalogue,
  openComparison,
  openEvidence,
} from "./css_evidence_page.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let matched: Awaited<ReturnType<typeof cssEvidenceFixture>>;
let unresolved: Awaited<ReturnType<typeof cssEvidenceFixture>>;
let material: Awaited<ReturnType<typeof cssEvidenceFixture>>;

test.beforeAll(async () => {
  matched = await cssEvidenceFixture(".auth { padding: 2px; }\n", 1);
  unresolved = await cssEvidenceFixture(".guide { --tone: red; }\n", 3);
  material = await cssEvidenceFixture(".auth { padding: 2px; }\n", 1, true, {
    material: true,
  });
});
test.afterAll(async () => {
  await matched?.close();
  await unresolved?.close();
  await material?.close();
});

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} stylesheet evidence`, () => {
    test.use({ viewport: size });

    test("a screen the changed styles reach names them in Details", async ({
      page,
    }) => {
      await page.goto(`${matched.url}/view/home/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(FILES_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.getByRole("listitem").first()).toHaveText(
        STYLESHEET,
      );
      await expect(
        evidence.getByText(MATCHED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
      await expect(evidence).not.toContainText(EXCLUDED_LEAD);
      await expect(evidence).not.toContainText("no-matching-rule");
      await expect(page.locator("h2")).toHaveText("Home");
      await expect(page.locator(".mbk-screen-head")).not.toContainText(".auth");
      expect(await evidenceSpacing(evidence)).toEqual({
        paragraph: "8px",
        list: "8px",
        afterList: "14px",
      });

      for (const scheme of ["dark", "light"] as const)
        for (const size of ["mobile", "desktop"] as const) {
          await chooseScheme(page, scheme);
          await chooseViewport(page, size);
          await expect(
            evidence.getByText(MATCHED_LEAD, { exact: true }),
          ).toBeVisible();
          await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
        }
    });

    test("an excluded screen stays out of Changes and explains why", async ({
      page,
    }) => {
      await page.goto(`${matched.url}/view/details/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(EXCLUDED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(
        evidence.getByText("Examined and excluded:", { exact: true }),
      ).toBeVisible();
      await expect(evidence.getByRole("listitem")).toHaveText([STYLESHEET]);
      await expect(
        evidence.getByText(SCREEN_TERMINAL, { exact: true }),
      ).toBeVisible();
      await expect(evidence).not.toContainText(FILES_LEAD);
      await expect(evidence).not.toContainText(MATCHED_LEAD);
      await expect(evidence).not.toContainText(VARIANT_TERMINAL);
      await expect(evidence.locator("code.mbk-code")).toHaveCount(0);

      await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
      await openCatalogue(page, name);
      await page.locator('[data-filter="changed"]').click();
      await expect(
        page.locator('[data-route="home/index.html"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-route="details/index.html"]'),
      ).toBeHidden();
      await expect(page.locator(".mbk-nav-scroll")).not.toContainText(".auth");
      await expect(page.locator(".mbk-nav-scroll")).not.toContainText(
        "stylesheet",
      );
    });

    test("a change that can reach anything says so without naming a status", async ({
      page,
    }) => {
      await page.goto(`${unresolved.url}/view/home/`);
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(UNRESOLVED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.locator("code.mbk-code")).toHaveText([".guide"]);
      await expect(evidence).not.toContainText("unresolved");
      await expect(evidence).not.toContainText("matched");
    });

    test("an unchanged saved view closes with its own status line", async ({
      page,
    }) => {
      await page.goto(`${matched.url}/view/badge/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(VARIANT_TERMINAL, { exact: true }),
      ).toBeVisible();
      await expect(evidence).not.toContainText(SCREEN_TERMINAL);
    });

    test("a rendered change keeps the screen heading beside its styles", async ({
      page,
    }) => {
      await page.goto(`${material.url}/view/home/`);
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(MATCHED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(await openComparison(page)).toHaveText([
        `Mobile · ${CHANGED_HEADING}`,
        `Desktop · ${CHANGED_HEADING}`,
      ]);
    });

    test("the comparison heading leads with the style outcome", async ({
      page,
    }) => {
      await page.goto(`${matched.url}/view/home/`);
      await page
        .getByRole("button", { name: "Side by side", exact: true })
        .click();
      const headings = page.locator(".mbk-diff-view h3");
      await expect(headings.first()).toBeVisible();
      for (const heading of await headings.allTextContents())
        expect(heading).toMatch(/· Styles this screen uses changed$/);
      expect(
        await page.locator("[data-diff-stage] iframe").count(),
      ).toBeGreaterThanOrEqual(2);
    });
  });
}
