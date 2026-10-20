/**
 * Whole-page stylesheet Details on the copied comparison output, under the
 * CSS evidence shell contract and the approved document design
 * `design/changes/impact/styles/page`. The changed handbook names each of
 * its stylesheets once with the page copy, repeats the design's outcomes and
 * spacing, keeps its last style reachable on a short screen, and keeps the
 * same facts across navigation. The unchanged notes page lists its examined
 * stylesheet and ends with its terminal line.
 */

import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import { pageStylesheets } from "../helpers/comparison_evidence_groups.js";
import { repositoryRoot } from "../helpers/fixture.js";

import {
  BASE,
  EXAMINED_LEAD,
  INSPECTOR_VIEWPORTS,
  PAGE_EXCLUDED_LEAD,
  PAGE_FILES_LEAD,
  PAGE_MATCHED_LEAD,
  PAGE_OUTSIDE_LEAD,
  PAGE_TERMINAL,
  PAGE_UNRESOLVED_LEAD,
  evidenceFiles,
  evidenceSpacing,
  openPageEvidence,
  type EvidenceFile,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { chooseFilter, navRow } from "./comparison_ui.js";
import { designFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { ownExampleServerUrl } from "./example_servers.js";

const HANDBOOK = comparisonPaths.changedPage;
const NOTES = comparisonPaths.unchangedPage;
const HANDBOOK_FILES: EvidenceFile[] = [
  [pageStylesheets.actions, [[PAGE_OUTSIDE_LEAD, [".action"]]]],
  [
    pageStylesheets.handbook,
    [
      [PAGE_MATCHED_LEAD, ["article h2"]],
      [PAGE_UNRESOLVED_LEAD, [":root"]],
    ],
  ],
];

// The approved design opens from the example's own origin.
test.beforeEach(({ allowBrowserError, baseURL }) => {
  documentFavicon(allowBrowserError, ownExampleServerUrl() ?? baseURL!);
});

/** The approved document design at one viewport. */
function documentDesignUrl(viewport: string): string {
  return designFileUrl(
    path.join(
      repositoryRoot,
      "examples/basic/mokly-generated/design/changes/impact/styles/page",
      `index.${viewport}.html`,
    ),
  ).href;
}

/** The status beside the routed title. */
function headStatus(page: Page): Locator {
  return page.locator(".mbk-screen-head .mbk-entry-status");
}

/** Open the handbook and wait until its Details show every file. */
async function openHandbook(page: Page): Promise<Locator> {
  await page.goto(`/view/${HANDBOOK}/`);
  const evidence = await openPageEvidence(page);
  await expect.poll(() => evidenceFiles(evidence)).toEqual(HANDBOOK_FILES);
  return evidence;
}

/** How many lines the head title takes; its chips wrap before the title does. */
function titleLines(page: Page): Promise<number> {
  return page
    .locator(".mbk-screen-head .mbk-title-row h2")
    .evaluate((title) => {
      const range = document.createRange();
      range.selectNodeContents(title);
      return new Set(
        [...range.getClientRects()].map((rect) => Math.round(rect.top)),
      ).size;
    });
}

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} whole-page evidence`, () => {
    test.use({ viewport: size });

    test("a changed document names each stylesheet once with the page copy", async ({
      page,
    }) => {
      const evidence = await openHandbook(page);
      await expect(headStatus(page)).toHaveText("Changed");
      await expect(
        page.locator(
          "#mb-main [data-diff-screen], #mb-main [data-viewport-option], .mbk-diff-toolbar",
        ),
      ).toHaveCount(0);
      await expect(evidence.locator("h3")).toHaveText(["Comparison details"]);
      await expect(
        evidence.getByText(PAGE_FILES_LEAD, { exact: true }),
      ).toBeVisible();
      expect(await evidenceSpacing(evidence)).toEqual({
        sentence: "8px",
        styles: "8px",
        afterList: "14px",
      });
      await expect(evidence).not.toContainText(
        /Changed component|Shared component changes|this screen|saved view|[0-9a-f]{64}/u,
      );
      await expect(page.locator(".mbk-screen-head")).not.toContainText(
        /\.action|article h2|:root|\.css/u,
      );
    });

    test("the shell repeats the approved document mockup's layout and copy", async ({
      page,
    }) => {
      const evidence = await openHandbook(page);
      const spacing = await evidenceSpacing(evidence);
      await expect(page.locator("#mb-main .mbk-screen-head h2")).toHaveText(
        "Getting started",
      );
      expect(await titleLines(page)).toBe(1);
      await page.goto(documentDesignUrl(name));
      const card = page.locator(".mbk-comparison-details");
      await expect(
        card.getByText(PAGE_FILES_LEAD, { exact: true }),
      ).toBeVisible();
      // The design names the same files from its own folder.
      const approved = await evidenceFiles(card);
      expect(approved.map(([file]) => path.posix.basename(file))).toEqual(
        HANDBOOK_FILES.map(([file]) => path.posix.basename(file)),
      );
      expect(approved.map(([, outcomes]) => outcomes)).toEqual(
        HANDBOOK_FILES.map(([, outcomes]) => outcomes),
      );
      expect(await evidenceSpacing(card)).toEqual(spacing);
      await expect(
        page.locator(".mbk-screen-head .ce-change-status"),
      ).toHaveText("Changed");
      expect(await titleLines(page)).toBe(1);
    });

    test("an unchanged document lists its examined stylesheet and ends with its terminal line", async ({
      page,
    }) => {
      await page.goto(`/view/${NOTES}/`);
      await expect(headStatus(page)).toHaveText("Unmodified");
      const evidence = await openPageEvidence(page);
      await expect(evidence.locator("p")).toHaveText([
        BASE,
        PAGE_EXCLUDED_LEAD,
        EXAMINED_LEAD,
        PAGE_TERMINAL,
      ]);
      await expect(evidence.locator("li")).toHaveText([pageStylesheets.notes]);
      await expect(evidence.locator(".mbk-evidence-files")).toHaveCount(0);
    });
  });
}

test.describe("whole-page evidence on a short screen", () => {
  test.use({ viewport: { width: 390, height: 640 } });

  test("the open Details scroll to the last style and keep the document in view", async ({
    page,
  }) => {
    const evidence = await openHandbook(page);
    const last = evidence.locator("code").last();
    await expect(last).toHaveText(":root");
    await page.locator("[data-mokly-details]").hover();
    await page.mouse.wheel(0, 2000);
    await expect(last).toBeInViewport();
    const stage = await page.locator(".mbk-stage-embed").boundingBox();
    expect(stage?.height ?? 0).toBeGreaterThan(100);
  });
});

test.describe("whole-page evidence across navigation", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Changes lists the document and its Details keep the same facts", async ({
    page,
  }) => {
    await openHandbook(page);
    await chooseFilter(page, "changed");
    await expect(
      page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
    ).toHaveText("29");
    await expect(navRow(page, HANDBOOK)).toBeVisible();
    await expect(navRow(page, NOTES)).toBeHidden();
    expect(await evidenceFiles(page.locator("[data-page-evidence]"))).toEqual(
      HANDBOOK_FILES,
    );
    await navRow(page, comparisonPaths.pageComponent).click();
    await expect(page.locator("#mb-main .mbk-screen-head h2")).toHaveText(
      "Action",
    );
    await navRow(page, HANDBOOK).click();
    await expect(page.locator("#mb-main .mbk-screen-head h2")).toHaveText(
      "Getting started",
    );
    await expect(headStatus(page)).toHaveText("Changed");
    const evidence = await openPageEvidence(page);
    await expect.poll(() => evidenceFiles(evidence)).toEqual(HANDBOOK_FILES);
  });
});
