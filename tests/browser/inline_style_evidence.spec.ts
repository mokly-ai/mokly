import { expect, test } from "@playwright/test";

import {
  CHANGED_HEADING,
  INSPECTOR_VIEWPORTS,
  MATCHED_LEAD,
  SCREEN_TERMINAL,
  openComparison,
  openEvidence,
} from "./css_evidence_page.js";
import { inlineStyleEvidenceFixture } from "./inline_style_evidence_fixture.js";

const PAGE_EXCLUDED_LEAD =
  "Styles on this page changed, but none of the changed styles apply to this screen.";
const SHARED_COMPONENT_NOTE =
  "Shared component changes affect this preview. This page has no independent entry in Changes.";

let fixture: Awaited<ReturnType<typeof inlineStyleEvidenceFixture>>;
test.beforeAll(async () => {
  fixture = await inlineStyleEvidenceFixture();
});
test.afterAll(async () => fixture?.close());

for (const [name, viewport] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} inline style evidence`, () => {
    test.use({ viewport });

    test("renders excluded, matched and affected classification in Details", async ({
      page,
    }) => {
      await page.goto(`${fixture.url}/view/screens/excluded.html`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const excluded = await openEvidence(page);
      await expect(
        excluded.getByText(PAGE_EXCLUDED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(
        excluded.getByText(SCREEN_TERMINAL, { exact: true }),
      ).toBeVisible();
      await expect(excluded).not.toContainText("Examined and excluded");
      await expect(excluded).not.toContainText(SHARED_COMPONENT_NOTE);
      await expect(page.locator(".mbk-cmp-toolbar")).toHaveCount(0);
      await expect(page.locator(".mbk-diff-view h3")).toHaveCount(0);
      await expect(page.locator("[data-workspace-inspector]")).toHaveCSS(
        "position",
        name === "mobile" ? "absolute" : "relative",
      );

      await page.goto(`${fixture.url}/view/screens/matched.html`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Changed",
      );
      const matched = await openEvidence(page);
      await expect(
        matched.getByText(MATCHED_LEAD, { exact: true }),
      ).toBeVisible();
      await expect(matched.locator("code.mbk-code")).toHaveText([".entry"]);
      await expect(matched).not.toContainText(PAGE_EXCLUDED_LEAD);
      await expect(await openComparison(page)).toHaveText([
        `Mobile · ${CHANGED_HEADING}`,
        `Desktop · ${CHANGED_HEADING}`,
      ]);

      await page.goto(`${fixture.url}/view/screens/affected.html`);
      const affected = await openEvidence(page);
      await expect(affected).toContainText("Changed component: Action");
      await expect(
        affected.getByText(SHARED_COMPONENT_NOTE, { exact: true }),
      ).toBeVisible();
      await expect(affected).not.toContainText(PAGE_EXCLUDED_LEAD);
      await expect(affected).not.toContainText(MATCHED_LEAD);
    });
  });
}
