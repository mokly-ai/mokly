import { expect, test } from "@playwright/test";

import { parseReviewResult } from "../../packages/viewer/dist/review/result_validation.js";

import { cssEvidenceFixture } from "./css_evidence_fixture.js";
import {
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  FILES_LEAD,
  INSPECTOR_VIEWPORTS,
  MATCHED_LEAD,
  SCREEN_TERMINAL,
  STYLESHEET,
  STYLE_HEADING,
  UNCHANGED_HEADING,
  UNNAMED_LEAD,
  UNRESOLVED_LEAD,
  evidenceSpacing,
  openCatalogue,
  openComparison,
  openEvidence,
} from "./css_evidence_page.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let matched: Awaited<ReturnType<typeof cssEvidenceFixture>>;
let unresolved: Awaited<ReturnType<typeof cssEvidenceFixture>>;
let unnamed: Awaited<ReturnType<typeof cssEvidenceFixture>>;

test.beforeAll(async () => {
  matched = await cssEvidenceFixture(".auth { padding: 2px; }\n", 2, false);
  unresolved = await cssEvidenceFixture(".guide { --tone: red; }\n", 3, false);
  unnamed = await cssEvidenceFixture(
    "@keyframes fixture-fade { from { opacity: 1; } to { opacity: 0.6; } }\n",
    3,
    false,
  );
});
test.afterAll(async () => {
  await matched?.close();
  await unresolved?.close();
  await unnamed?.close();
});

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} screen-only stylesheet evidence`, () => {
    test.use({ viewport: size });

    test("a screen the changed styles reach names them in Details", async ({
      page,
    }) => {
      await page.goto(`${matched.url}/view/screens/home.html`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(FILES_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(
        evidence.getByText(MATCHED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.getByRole("listitem")).toHaveText([
        STYLESHEET,
        ".auth",
      ]);
      await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
      await expect(evidence).not.toContainText(EXCLUDED_LEAD);
      await expect(evidence).not.toContainText(EXAMINED_LEAD);
      await expect(evidence).not.toContainText("no-matching-rule");
      await expect(evidence).not.toContainText("matched");
      await expect(page.locator("h2")).toHaveText("Home");
      await expect(page.locator(".mbk-screen-head")).not.toContainText(".auth");

      for (const scheme of ["dark", "light"] as const)
        for (const preview of ["mobile", "desktop"] as const) {
          await chooseScheme(page, scheme);
          await chooseViewport(page, preview);
          await expect(
            evidence.getByText(MATCHED_LEAD, { exact: true }),
          ).toBeVisible();
          await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
        }
    });

    test("a change that can reach anything says so without naming a status", async ({
      page,
    }) => {
      await page.goto(`${unresolved.url}/view/screens/home.html`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(FILES_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(
        evidence.getByText(UNRESOLVED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.getByRole("listitem")).toHaveText([
        STYLESHEET,
        ".guide",
      ]);
      await expect(evidence.locator("code.mbk-code")).toHaveText([".guide"]);
      await expect(evidence).not.toContainText(MATCHED_LEAD);
      await expect(evidence).not.toContainText(EXCLUDED_LEAD);
      await expect(evidence).not.toContainText("unresolved");
      await expect(evidence).not.toContainText("matched");
    });

    test("a change with no style to name says so and lists nothing", async ({
      page,
    }) => {
      await page.goto(`${unnamed.url}/view/screens/home.html`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(UNNAMED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.getByRole("listitem")).toHaveText([STYLESHEET]);
      await expect(evidence.locator("code.mbk-code")).toHaveCount(0);
      await expect(evidence).not.toContainText(UNRESOLVED_LEAD);
      await expect(evidence).not.toContainText(MATCHED_LEAD);
      await expect(evidence).not.toContainText(EXCLUDED_LEAD);
      expect(await evidenceSpacing(evidence)).toEqual({
        paragraph: "8px",
        list: "8px",
        afterList: "14px",
      });
      await expect(await openComparison(page)).toHaveText([
        `Mobile · ${STYLE_HEADING}`,
        `Desktop · ${STYLE_HEADING}`,
      ]);
    });

    test("an excluded screen stays out of Changes and explains why", async ({
      page,
    }) => {
      await page.goto(`${matched.url}/view/screens/details.html`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(EXCLUDED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(
        evidence.getByText(EXAMINED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.getByRole("listitem")).toHaveText([STYLESHEET]);
      await expect(evidence).not.toContainText(FILES_LEAD);
      await expect(evidence).not.toContainText(MATCHED_LEAD);
      await expect(evidence).not.toContainText(UNRESOLVED_LEAD);
      await expect(evidence).not.toContainText("no-matching-rule");
      await expect(
        evidence.getByText(SCREEN_TERMINAL, { exact: true }),
      ).toBeVisible();
      await expect(evidence.locator("code.mbk-code")).toHaveCount(0);
      await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
      await expect(page.locator("[data-diff-stage]")).toBeHidden();

      for (const scheme of ["dark", "light"] as const)
        for (const preview of ["mobile", "desktop"] as const) {
          await chooseScheme(page, scheme);
          await chooseViewport(page, preview);
          await expect(
            evidence.getByText(EXCLUDED_LEAD, { exact: true }),
          ).toBeVisible();
          await expect(evidence.getByRole("listitem")).toHaveText([STYLESHEET]);
        }

      await expect(page.locator(".mbk-nav-filter-count")).toHaveText("2");
      await openCatalogue(page, name);
      await page.locator('[data-filter="changed"]').click();
      await expect(
        page.locator('[data-route="screens/home.html"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-route="screens/compact.html"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-route="screens/details.html"]'),
      ).toBeHidden();
      await expect(page.locator(".mbk-nav-scroll")).not.toContainText(".auth");
      await expect(page.locator(".mbk-nav-scroll")).not.toContainText(
        "stylesheet",
      );
    });

    test("the comparison heading leads with the style outcome", async ({
      page,
    }) => {
      for (const fixture of [matched, unresolved]) {
        await page.goto(`${fixture.url}/view/screens/home.html`);
        await expect(await openComparison(page)).toHaveText([
          `Mobile · ${STYLE_HEADING}`,
          `Desktop · ${STYLE_HEADING}`,
        ]);
        expect(
          await page.locator("[data-diff-stage] iframe").count(),
        ).toBeGreaterThanOrEqual(4);
      }
    });

    test("a released viewport reads as unchanged beside a retained one", async ({
      page,
    }) => {
      await page.goto(`${matched.url}/view/screens/compact.html`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(MATCHED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
      await expect(evidence).not.toContainText(EXCLUDED_LEAD);
      await expect(evidence).not.toContainText(EXAMINED_LEAD);
      await expect(await openComparison(page)).toHaveText([
        `Mobile · ${STYLE_HEADING}`,
        `Desktop · ${UNCHANGED_HEADING}`,
      ]);
    });
  });
}

test.describe("screen-only evidence and its loaded comparison", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("classification evidence arrives first and survives the comparison", async ({
    page,
  }) => {
    let comparisonRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith("/review.json"))
        comparisonRequests++;
    });
    await page.goto(`${matched.url}/view/screens/home.html`);
    const evidence = await openEvidence(page);
    await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
    expect(comparisonRequests).toBe(0);

    const response = page.waitForResponse(
      (response) =>
        response.status() === 200 &&
        new URL(response.url()).pathname.endsWith("/review.json"),
      { timeout: 30_000 },
    );
    await page
      .getByRole("button", { name: "Side by side", exact: true })
      .click();
    expect(parseReviewResult(await (await response).json()).schemaVersion).toBe(
      2,
    );
    await expect(page.locator(".mbk-diff-view").first()).toBeVisible();
    await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
    await expect(
      evidence.getByText("Comparison details", { exact: true }),
    ).toHaveCount(1);
    await expect(evidence).not.toContainText("Shared component changes");
    await page.getByRole("button", { name: "Current", exact: true }).click();
    await expect(evidence.locator("code.mbk-code")).toHaveText([".auth"]);
  });
});
