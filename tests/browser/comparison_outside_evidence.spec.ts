/**
 * Component and screen stylesheet Details on the copied comparison output,
 * under the CSS evidence presentation contract and its approved designs. A
 * consuming component shows its consumed component's styles in Current
 * before any comparison. A changed component keeps its own sentence beside
 * its saved view's sentence under one file. A screen with an outside match
 * and an excluded-only screen repeat the copy and layout of the Canvas
 * evidence designs `design/canvas/evidence/styles/unresolved` and
 * `design/canvas/evidence/unchanged`.
 */

import path from "node:path";

import { expect } from "@playwright/test";

import { configuredStylesheets as sheets } from "../helpers/comparison_evidence_groups.js";
import { repositoryRoot } from "../helpers/fixture.js";

import {
  BASE,
  COMPONENT_FILES_LEAD,
  COMPONENT_LEAD,
  DESKTOP_INSPECTOR,
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  FILES_LEAD,
  OUTSIDE_LEAD,
  VARIANT_UNRESOLVED_LEAD,
  SCREEN_TERMINAL,
  UNRESOLVED_LEAD,
  VARIANT_SHARED_IMPACT,
  VARIANT_TERMINAL,
  evidenceFiles,
  evidenceSpacing,
  openChangesEvidence,
  openEvidence,
  type EvidenceFile,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  comparisonFrames,
  expectNoCompareModes,
  outcomeLines,
} from "./comparison_ui.js";
import { designFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { ownExampleServerUrl } from "./example_servers.js";
import { viewportFrame } from "./workspace_actions.js";

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

/** One approved design artboard at the desktop viewport. */
function designUrl(route: string): string {
  return designFileUrl(
    path.join(
      repositoryRoot,
      "examples/basic/mokly-generated",
      route,
      "index.desktop.html",
    ),
  ).href;
}

test.describe("desktop component and screen evidence", () => {
  test.use({ viewport: DESKTOP_INSPECTOR });

  test("a consuming component shows its styles in Current before any comparison", async ({
    page,
  }) => {
    await page.goto(`/view/${comparisonPaths.consumingComponent}/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    // Its detail makes the comparison eligible, which adds the Changes tab
    // that then holds the comparison details.
    await awaitRoutedDetail(page, comparisonPaths.consumingComponent);
    const evidence = await openChangesEvidence(page);
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
    // Current loads no comparison, so no frame compares.
    await expect(outcomeLines(page)).toHaveCount(0);
    await expect(comparisonFrames(page)).toHaveCount(0);
  });

  test("the changed component keeps its own sentence beside its saved view's", async ({
    page,
  }) => {
    for (const route of [
      comparisonPaths.changedVariant,
      comparisonPaths.component,
    ]) {
      await page.goto(`/view/${route}/`);
      const evidence = await openChangesEvidence(page);
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
    const evidence = await openChangesEvidence(page);
    await expect
      .poll(() => evidenceFiles(evidence))
      .toEqual([
        [sheets.changed, [[UNRESOLVED_LEAD, [":root"]]]],
        [sheets.theme, [[OUTSIDE_LEAD, [".accent"]]]],
      ]);
    const served = await evidenceSpacing(evidence);
    await page.goto(designUrl("design/canvas/evidence/styles/unresolved"));
    const card = page.locator(".cv-evidence [data-workspace-evidence]");
    await expect(card.getByText(FILES_LEAD, { exact: true })).toBeVisible();
    const approved = await evidenceFiles(card);
    expect(approved.map(([, outcomes]) => outcomes[0]?.[0])).toEqual([
      UNRESOLVED_LEAD,
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
    // The canvas keeps the current frames, and no frame compares.
    await expect(page.locator(viewportFrame("mobile"))).toBeVisible();
    await awaitRoutedDetail(page, comparisonPaths.unchanged);
    await expectNoCompareModes(page);
    await expect(
      page.getByRole("button", { name: "Side by side", exact: true }),
    ).toBeHidden();
    await expect(comparisonFrames(page)).toHaveCount(0);
    await expect(outcomeLines(page)).toHaveCount(0);
    await page.goto(designUrl("design/canvas/evidence/unchanged"));
    const card = page.locator(".cv-evidence [data-workspace-evidence]");
    await expect(card.locator("p")).toHaveText([DESIGN_BASE, ...sentences]);
    await expect(card.locator("li")).toHaveCount(1);
  });
});
