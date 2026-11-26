/**
 * Whole-page stylesheet Details on the copied comparison output, under the
 * CSS evidence shell contract and the approved Canvas document design
 * `design/canvas/evidence/page`. The changed handbook names each of
 * its stylesheets once with the page copy, repeats the design's outcomes and
 * spacing, keeps its last style reachable on a short screen, and keeps the
 * same facts across navigation. The unchanged notes page lists its examined
 * stylesheet and ends with its terminal line. The unchanged catalog page,
 * whose only changed style reaches it through a Card instance, shows that
 * style and links no changed component, because a page has no usage records.
 */

import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import {
  configuredStylesheets,
  pageStylesheets,
} from "../helpers/comparison_evidence_groups.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { expectNoComparison } from "./comparison_absence.js";
import {
  BASE,
  DESKTOP_INSPECTOR,
  EXAMINED_LEAD,
  PAGE_EXCLUDED_LEAD,
  PAGE_FILES_LEAD,
  PAGE_MATCHED_LEAD,
  PAGE_OUTSIDE_LEAD,
  PAGE_TERMINAL,
  PAGE_UNRESOLVED_LEAD,
  SHARED,
  evidenceFiles,
  evidenceSpacing,
  openPageEvidence,
  type EvidenceFile,
} from "./comparison_evidence_page.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  changesPaths,
  chooseFilter,
  compareStage,
  comparisonIndex,
  navRow,
} from "./comparison_ui.js";
import { designFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { ownExampleServerUrl } from "./example_servers.js";
import { inspectHead, inspectStatus, inspectTitle } from "./inspect_head.js";
import {
  DOCUMENT_FRAME,
  openInspectFold,
  openPanelTab,
} from "./workspace_actions.js";

const HANDBOOK = comparisonPaths.changedPage;
const NOTES = comparisonPaths.unchangedPage;
const CATALOG = comparisonPaths.componentPage;
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

/** The approved document design at the desktop viewport. */
function documentDesignUrl(): string {
  return designFileUrl(
    path.join(
      repositoryRoot,
      "examples/basic/mokly-generated/design/canvas/evidence/page",
      "index.desktop.html",
    ),
  ).href;
}

/**
 * Open the handbook, which Changes lists, and wait until the Details of its
 * Changes tab show every file.
 */
async function openHandbook(page: Page): Promise<Locator> {
  await page.goto(`/view/${HANDBOOK}/`);
  const evidence = await openPageEvidence(page, "Changes");
  await expect.poll(() => evidenceFiles(evidence)).toEqual(HANDBOOK_FILES);
  return evidence;
}

/**
 * How many lines Inspect's title takes; its status wraps before the title
 * does. Inspect shows first, because a hidden title has no lines.
 */
async function titleLines(page: Page): Promise<number> {
  await openPanelTab(page, "Inspect");
  return inspectTitle(page).evaluate((title) => {
    const range = document.createRange();
    range.selectNodeContents(title);
    return new Set(
      [...range.getClientRects()].map((rect) => Math.round(rect.top)),
    ).size;
  });
}

test.describe("desktop whole-page evidence", () => {
  test.use({ viewport: DESKTOP_INSPECTOR });

  test("a changed document names each stylesheet once with the page copy", async ({
    page,
  }) => {
    const evidence = await openHandbook(page);
    await expect(inspectStatus(page)).toHaveText("Changed");
    await awaitRoutedDetail(page, HANDBOOK);
    // A page has no compare, no comparison band and no Frames filter.
    await expect(compareStage(page)).toHaveCount(0);
    await expect(page.locator("[data-frames-toggle]")).toHaveCount(0);
    await expectNoComparison(page);
    await expect(evidence.locator("h3")).toHaveText(["Comparison details"]);
    await expect(
      evidence.getByText(PAGE_FILES_LEAD, { exact: true }),
    ).toBeVisible();
    expect(await evidenceSpacing(evidence)).toMatchObject({
      sentence: "8px",
      styles: "8px",
      afterList: "14px",
    });
    await expect(evidence).not.toContainText(
      /Changed component|Shared component changes|this screen|saved view|this variant|[0-9a-f]{64}/u,
    );
    await expect(inspectHead(page)).not.toContainText(
      /\.action|article h2|:root|\.css/u,
    );
  });

  test("the shell repeats the approved document mockup's layout and copy", async ({
    page,
  }) => {
    const evidence = await openHandbook(page);
    const spacing = await evidenceSpacing(evidence);
    await expect(inspectTitle(page)).toHaveText("Getting started");
    expect(await titleLines(page)).toBe(1);
    await page.goto(documentDesignUrl());
    const card = page.locator(".cv-evidence [data-page-evidence]");
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
    expect(await evidenceSpacing(card)).toMatchObject({
      sentence: spacing.sentence,
      styles: spacing.styles,
      afterList: spacing.afterList,
    });
    // The design's status sits beside its title in the section head.
    await expect(
      page.locator(".cv-canvas .mbk-entry-status:visible"),
    ).toHaveText("Changed");
  });

  test("an unchanged document lists its examined stylesheet and ends with its terminal line", async ({
    page,
  }) => {
    await page.goto(`/view/${NOTES}/`);
    await expect(inspectStatus(page)).toHaveText("Unmodified");
    const evidence = await openPageEvidence(page, "Inspect");
    await expect(evidence.locator("p")).toHaveText([
      BASE,
      PAGE_EXCLUDED_LEAD,
      EXAMINED_LEAD,
      PAGE_TERMINAL,
    ]);
    await expect(evidence.locator("li")).toHaveText([pageStylesheets.notes]);
    await expect(evidence.locator(".mbk-evidence-files")).toHaveCount(0);
  });

  test("a page that uses a changed component shows its styles and links no component", async ({
    page,
  }) => {
    await page.goto(`/view/${CATALOG}/`);
    await expect(inspectStatus(page)).toHaveText("Unmodified");
    const evidence = await openPageEvidence(page, "Inspect");
    await expect
      .poll(() => evidenceFiles(evidence))
      .toEqual([
        [configuredStylesheets.theme, [[PAGE_MATCHED_LEAD, [".accent"]]]],
      ]);
    await expect(evidence.locator(":scope > p")).toHaveText([
      BASE,
      PAGE_FILES_LEAD,
      PAGE_TERMINAL,
    ]);
    await expect(evidence).not.toContainText(/Changed component/u);
    await expect(evidence).not.toContainText(SHARED);
    // Card's Usage lists its consumers, and a page is none of them.
    await page.goto(`/view/${comparisonPaths.component}/`);
    const usage = await openInspectFold(page, "usage");
    await expect(
      usage.locator('[data-usage-section="used-by"]').getByRole("link"),
    ).toHaveText(["Toolbar", "Changed screen", "Consumer screen"]);
    await expect(usage).not.toContainText("Catalog");
  });
});

test.describe("whole-page evidence on a short screen", () => {
  test.use({ viewport: { width: 390, height: 640 } });

  test("the open Details scroll to the last style and keep the document in view", async ({
    page,
  }) => {
    const evidence = await openHandbook(page);
    const last = evidence.locator("code").last();
    await expect(last).toHaveText(":root");
    // The panel's sheet scrolls the comparison details under the pointer.
    await evidence.hover();
    await page.mouse.wheel(0, 2000);
    await expect(last).toBeInViewport();
    // The panel's sheet leaves the top of the reading frame in view above it.
    const document = await page.locator(DOCUMENT_FRAME).boundingBox();
    const sheet = await page
      .getByRole("region", { name: "Panel", exact: true })
      .boundingBox();
    expect(document && sheet).toBeTruthy();
    expect(sheet!.y - Math.max(document!.y, 0)).toBeGreaterThan(100);
  });
});

test.describe("whole-page evidence across navigation", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Changes lists the document and its Details keep the same facts", async ({
    page,
    request,
    baseURL,
  }) => {
    const included = changesPaths(await comparisonIndex(request, baseURL));
    expect(included).toContain(HANDBOOK);
    await openHandbook(page);
    await chooseFilter(page, "changed");
    await expect(
      page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
    ).toHaveText(String(included.length));
    await expect(navRow(page, HANDBOOK)).toBeVisible();
    await expect(navRow(page, NOTES)).toBeHidden();
    expect(await evidenceFiles(page.locator("[data-page-evidence]"))).toEqual(
      HANDBOOK_FILES,
    );
    await navRow(page, comparisonPaths.pageComponent).click();
    await expect(inspectTitle(page)).toHaveText("Action");
    await navRow(page, HANDBOOK).click();
    await expect(inspectTitle(page)).toHaveText("Getting started");
    await expect(inspectStatus(page)).toHaveText("Changed");
    const evidence = await openPageEvidence(page, "Changes");
    await expect.poll(() => evidenceFiles(evidence)).toEqual(HANDBOOK_FILES);
  });
});
