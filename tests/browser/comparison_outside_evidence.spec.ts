/**
 * Component and screen stylesheet Details on the copied comparison output,
 * under the CSS evidence presentation contract and its approved designs. A
 * consuming component shows its consumed component's styles in Current
 * before any comparison. A changed component keeps its own sentence beside
 * its saved view's sentence under one file. A screen with an outside match
 * and an excluded-only screen repeat the copy and layout of
 * `design/components/states/shared-impact/style-outside` and
 * `design/changes/impact/styles/matched-excluded/excluded-only`.
 */

import path from "node:path";

import { expect } from "@playwright/test";

import { configuredStylesheets as sheets } from "../helpers/comparison_evidence_groups.js";
import { repositoryRoot } from "../helpers/fixture.js";

import {
  BASE,
  COMPONENT_FILES_LEAD,
  COMPONENT_LEAD,
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  FILES_LEAD,
  INSPECTOR_VIEWPORTS,
  OUTSIDE_LEAD,
  VARIANT_UNRESOLVED_LEAD,
  SCREEN_TERMINAL,
  UNRESOLVED_LEAD,
  VARIANT_SHARED_IMPACT,
  VARIANT_TERMINAL,
  evidenceFiles,
  evidenceSpacing,
  openEvidence,
  type EvidenceFile,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { awaitRoutedDetail } from "./comparison_ui.js";
import { designFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { ownExampleServerUrl } from "./example_servers.js";

const CARD_FILES: EvidenceFile[] = [
  [
    sheets.card,
    [
      [COMPONENT_LEAD, [".accent"]],
      [VARIANT_UNRESOLVED_LEAD, [":root"]],
    ],
  ],
  [sheets.theme, [[COMPONENT_LEAD, [".accent"]]]],
];
/** The design branch point, which names the example's own base. */
const DESIGN_BASE = "Compared with the branch point on origin/main.";

// The approved designs open from the example's own origin.
test.beforeEach(({ allowBrowserError, baseURL }) => {
  documentFavicon(allowBrowserError, ownExampleServerUrl() ?? baseURL!);
});

/** One approved design artboard at one viewport. */
function designUrl(route: string, viewport: string): string {
  return designFileUrl(
    path.join(
      repositoryRoot,
      "examples/basic/mokly-generated",
      route,
      `index.${viewport}.html`,
    ),
  ).href;
}

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} component and screen evidence`, () => {
    test.use({ viewport: size });

    test("a consuming component shows its styles in Current before any comparison", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.consumingComponent}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const evidence = await openEvidence(page);
      await expect(
        evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => evidenceFiles(evidence))
        .toEqual([[sheets.theme, [[COMPONENT_LEAD, [".accent"]]]]]);
      await expect(
        evidence.getByRole("link", { name: "Card", exact: true }),
      ).toHaveAttribute("href", `/view/${comparisonPaths.component}/`);
      // Its own views stay unmodified, but Card changes the shared preview.
      // The shared-component sentence replaces the no-changes line.
      await expect(evidence.locator("p").last()).toHaveText(
        VARIANT_SHARED_IMPACT,
      );
      await expect(evidence).not.toContainText(VARIANT_TERMINAL);
      await expect(page.locator(".mbk-diff-view")).toHaveCount(0);
    });

    test("the changed component keeps its own sentence beside its saved view's", async ({
      page,
    }) => {
      for (const route of [
        comparisonPaths.changedVariant,
        comparisonPaths.component,
      ]) {
        await page.goto(`/view/${route}/`);
        const evidence = await openEvidence(page);
        await expect(
          evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
        ).toBeVisible();
        await expect.poll(() => evidenceFiles(evidence)).toEqual(CARD_FILES);
        await expect(evidence).not.toContainText(VARIANT_TERMINAL);
      }
    });

    test("the shell repeats the approved mockup's layout and copy", async ({
      page,
    }) => {
      await page.goto(`/view/${comparisonPaths.changed}/`);
      const evidence = await openEvidence(page);
      await expect
        .poll(() => evidenceFiles(evidence))
        .toEqual([
          [sheets.changed, [[UNRESOLVED_LEAD, [":root"]]]],
          [sheets.theme, [[OUTSIDE_LEAD, [".accent"]]]],
        ]);
      const served = await evidenceSpacing(evidence);
      await page.goto(
        designUrl("design/components/states/shared-impact/style-outside", name),
      );
      const card = page.locator(".ce-comparison-evidence");
      await expect(card.getByText(FILES_LEAD, { exact: true })).toBeVisible();
      const approved = await evidenceFiles(card);
      expect(approved.map(([, outcomes]) => outcomes[0]?.[0])).toEqual([
        OUTSIDE_LEAD,
      ]);
      const spacing = await evidenceSpacing(card);
      expect([spacing.sentence, spacing.styles]).toEqual([
        served.sentence,
        served.styles,
      ]);
    });

    test("an excluded-only screen shows the mockup's Details card and no comparison", async ({
      page,
    }) => {
      const sentences = [EXCLUDED_LEAD, EXAMINED_LEAD, SCREEN_TERMINAL];
      await page.goto(`/view/${comparisonPaths.unchanged}/`);
      await expect(page.locator("[data-workspace-status]")).toHaveText(
        "Unmodified",
      );
      const evidence = await openEvidence(page);
      await expect(evidence.locator("h3")).toHaveText(["Comparison details"]);
      await expect(evidence.locator("p")).toHaveText([BASE, ...sentences]);
      await expect(evidence.locator("li")).toHaveText([sheets.theme]);
      await expect(page.locator("[data-current-screen]")).toBeVisible();
      await awaitRoutedDetail(page, comparisonPaths.unchanged);
      await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Side by side", exact: true }),
      ).toBeHidden();
      await expect(page.locator("[data-diff-stage]")).toBeHidden();
      await expect(page.locator(".mbk-diff-view h3")).toHaveCount(0);
      await page.goto(
        designUrl(
          "design/changes/impact/styles/matched-excluded/excluded-only",
          name,
        ),
      );
      const card = page.locator(".mbk-comparison-details");
      await expect(card.locator("p")).toHaveText([DESIGN_BASE, ...sentences]);
      await expect(card.locator("li")).toHaveCount(1);
      await expect(
        page.locator(".mbk-screen-head .ce-change-status"),
      ).toHaveText("Unmodified");
    });
  });
}
