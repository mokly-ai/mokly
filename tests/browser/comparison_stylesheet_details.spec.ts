import { expect, type Locator } from "@playwright/test";

import { configuredStylesheets as sheets } from "../helpers/comparison_evidence_groups.js";

import {
  BASE,
  COMPONENT_FILES_LEAD,
  COMPONENT_LEAD,
  DESKTOP_INSPECTOR,
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  FILES_LEAD,
  MATCHED_LEAD,
  OUTSIDE_LEAD,
  VARIANT_UNRESOLVED_LEAD,
  SCREEN_TERMINAL,
  SHARED_IMPACT,
  UNRESOLVED_LEAD,
  VARIANT_EXCLUDED_LEAD,
  VARIANT_TERMINAL,
  evidenceFiles,
  openChangesEvidence,
  openEvidence,
  type EvidenceFile,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  changesPaths,
  chooseFilter,
  comparisonIndex,
  expectNoCompareModes,
  navRow,
  outcomeLines,
  showMode,
} from "./comparison_ui.js";
import { inspectHead, inspectTitle } from "./inspect_head.js";
import { chooseViewport, setFrames } from "./workspace_actions.js";

/** Status literals of the evidence format never reach the reader. */
async function expectNoStatusWords(evidence: Locator): Promise<void> {
  for (const word of [/\bmatched\b/, /\bunresolved\b/, /\bentry\b/])
    await expect(evidence).not.toContainText(word);
  await expect(evidence).not.toContainText(/[0-9a-f]{64}/);
}

test.describe("desktop stylesheet Details", () => {
  test.use({ viewport: DESKTOP_INSPECTOR });

  test("a screen the changed styles reach names them in Details", async ({
    page,
  }) => {
    await page.goto(`/view/${comparisonPaths.darkOnly}/`);
    // The Frames filter shows the Dark views alone, which changed.
    await setFrames(page, { dark: true, light: false });
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
    const evidence = await openChangesEvidence(page);
    await expect(evidence.getByText(FILES_LEAD, { exact: true })).toBeVisible();
    const files: EvidenceFile[] = [[sheets.dusk, [[MATCHED_LEAD, [".dusk"]]]]];
    await expect.poll(() => evidenceFiles(evidence)).toEqual(files);
    await expect(evidence.locator("code.mbk-code")).toHaveText([".dusk"]);
    // The shared stylesheet changed too, but no changed style reaches it.
    await expect(
      evidence.getByText(EXCLUDED_LEAD, { exact: true }),
    ).toBeVisible();
    await expect(
      evidence.getByText(EXAMINED_LEAD, { exact: true }),
    ).toBeVisible();
    await expectNoStatusWords(evidence);
    await expect(inspectTitle(page)).toHaveText("Dusk screen");
    await expect(inspectHead(page)).not.toContainText(".dusk");
    for (const preview of ["mobile", "desktop"] as const) {
      await chooseViewport(page, preview);
      await expect.poll(() => evidenceFiles(evidence)).toEqual(files);
    }
    // Details merge every compared view, so the Light views alone, which
    // stay unmodified, keep the same facts.
    await setFrames(page, { light: true, dark: false });
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    // The Frames filter stands in Inspect; the details show in Changes.
    await openChangesEvidence(page);
    await expect.poll(() => evidenceFiles(evidence)).toEqual(files);
    await expect(
      evidence.getByText(EXCLUDED_LEAD, { exact: true }),
    ).toBeVisible();
  });

  test("a change that can reach anything says so without naming a status", async ({
    page,
  }) => {
    await page.goto(`/view/${comparisonPaths.changed}/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
    const evidence = await openChangesEvidence(page);
    await expect(
      evidence.getByText(UNRESOLVED_LEAD, { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await evidenceFiles(evidence))[0])
      .toEqual([sheets.changed, [[UNRESOLVED_LEAD, [":root"]]]]);
    await expectNoStatusWords(evidence);
  });

  test("a screen names outside matches and keeps its unresolved paragraph", async ({
    page,
  }) => {
    await page.goto(`/view/${comparisonPaths.changed}/`);
    const evidence = await openChangesEvidence(page);
    await expect(evidence.getByText(FILES_LEAD, { exact: true })).toBeVisible();
    await expect
      .poll(() => evidenceFiles(evidence))
      .toEqual([
        [sheets.changed, [[UNRESOLVED_LEAD, [":root"]]]],
        [sheets.theme, [[OUTSIDE_LEAD, [".accent"]]]],
      ]);
    await expect(
      evidence.getByRole("link", { name: "Card", exact: true }),
    ).toHaveAttribute("href", `/view/${comparisonPaths.component}/`);
    await expect(evidence).not.toContainText(SCREEN_TERMINAL);
    await expect(inspectHead(page)).not.toContainText(".accent");
  });

  test("an excluded screen stays out of Changes and explains why", async ({
    page,
  }) => {
    await page.goto(`/view/${comparisonPaths.unchanged}/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    await awaitRoutedDetail(page, comparisonPaths.unchanged);
    await expectNoCompareModes(page);
    const evidence = await openEvidence(page);
    // The paragraphs come from the entry detail; then the list stays empty.
    await expect(evidence.locator("p")).toHaveText([
      BASE,
      EXCLUDED_LEAD,
      EXAMINED_LEAD,
      SCREEN_TERMINAL,
    ]);
    await expect(evidence.locator(".mbk-evidence-files")).toHaveCount(0);
    await expect(evidence.locator("ul > li")).toHaveText([sheets.theme]);
    await expectNoStatusWords(evidence);
    await chooseFilter(page, "changed");
    await expect(navRow(page, comparisonPaths.unchanged)).toBeHidden();
  });

  test("an affected-only screen keeps its full styles and explains the shared change", async ({
    page,
    request,
    baseURL,
  }) => {
    const included = changesPaths(await comparisonIndex(request, baseURL));
    await page.goto(`/view/${comparisonPaths.consumer}/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    // Its detail makes the comparison eligible, which adds the Changes tab
    // that then holds the comparison details.
    await awaitRoutedDetail(page, comparisonPaths.consumer);
    const evidence = await openChangesEvidence(page);
    await expect
      .poll(() => evidenceFiles(evidence))
      .toEqual([[sheets.theme, [[MATCHED_LEAD, [".accent"]]]]]);
    await expect(
      evidence.getByRole("link", { name: "Card", exact: true }),
    ).toBeVisible();
    // The shared-component sentence closes Details in place of the
    // no-changes line, because Card changes how the screen renders.
    await expect(evidence.locator("p").last()).toHaveText(SHARED_IMPACT);
    await expect(
      evidence.getByText(SCREEN_TERMINAL, { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
    ).toHaveText(String(included.length));
    await chooseFilter(page, "changed");
    await expect(navRow(page, comparisonPaths.consumer)).toBeHidden();
    await expect(navRow(page, comparisonPaths.component)).toBeVisible();
  });

  test("an unchanged saved view closes with its own status line", async ({
    page,
  }) => {
    await page.goto(`/view/${comparisonPaths.quietParent}/`);
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    // Its set's removed variant compares, so the set offers its Changes
    // tab, which holds the details.
    const evidence = await openChangesEvidence(page);
    await expect(
      evidence.getByText(VARIANT_EXCLUDED_LEAD, { exact: true }),
    ).toBeVisible();
    await expect(evidence.locator("p").last()).toHaveText(VARIANT_TERMINAL);
    await expect(evidence).not.toContainText(SCREEN_TERMINAL);
  });
});

test("the comparison heading leads with the style outcome", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Each compared frame's outcome line names the frame, then the outcome of
  // its view: the Dark view of the dark-only change changed only its styles.
  await page.goto(`/view/${comparisonPaths.darkOnly}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Overlay", 4);
  await expect(outcomeLines(page)).toHaveText([
    "Desktop · Light · No changes to this screen",
    "Desktop · Dark · Styles this screen uses changed",
  ]);
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await showMode(page, "Overlay", 8);
  await expect(outcomeLines(page)).toHaveText([
    "Desktop · Light · Screen changed",
    "Mobile · Light · Screen changed",
    "Desktop · Dark · Screen changed",
    "Mobile · Dark · Screen changed",
  ]);
  await page.goto(`/view/${comparisonPaths.component}/`);
  const evidence = await openChangesEvidence(page);
  await expect
    .poll(() => evidenceFiles(evidence))
    .toEqual([
      [
        sheets.card,
        [
          [COMPONENT_LEAD, [".accent"]],
          [VARIANT_UNRESOLVED_LEAD, [":root"]],
        ],
      ],
      [sheets.theme, [[COMPONENT_LEAD, [".accent"]]]],
    ]);
  await expect(
    evidence.getByText(COMPONENT_FILES_LEAD, { exact: true }),
  ).toBeVisible();
  // Each eligible row compares its Light and Dark frames: the own example,
  // whose only reasons are its stylesheets, then the changed Featured
  // variant, whose rendered content also changed. The added Fresh variant's
  // row stays current.
  await showMode(page, "Overlay", 8);
  await expect(outcomeLines(page)).toHaveText([
    "Card · Light · Styles this variant uses changed",
    "Card · Dark · Styles this variant uses changed",
    "Featured · Light · Variant changed",
    "Featured · Dark · Variant changed",
  ]);
});
