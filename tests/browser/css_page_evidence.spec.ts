import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import {
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
} from "./css_evidence_page.js";
import { cssPageFixture } from "./css_page_fixture.js";

const HANDBOOK_FILES = [
  ["mockups/actions.css", [[PAGE_OUTSIDE_LEAD, [".action"]]]],
  [
    "mockups/handbook.css",
    [
      [PAGE_MATCHED_LEAD, ["article h2"]],
      [PAGE_UNRESOLVED_LEAD, [":root"]],
    ],
  ],
];

let fixture: Awaited<ReturnType<typeof cssPageFixture>>;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  fixture = await cssPageFixture();
});
test.afterAll(async () => fixture?.close());

/** The approved document story, opened directly from the generated design. */
function documentDesignUrl(viewport: string): string {
  return pathToFileURL(
    path.join(
      repositoryRoot,
      `examples/basic/mokly-generated/design/changes/impact/styles/page/index.${viewport}.html`,
    ),
  ).href;
}

/** The status beside the routed title, which a page shows only once known. */
function headStatus(page: Page): Locator {
  return page.locator(".mbk-screen-head .mbk-entry-status");
}

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} whole-document page evidence`, () => {
    test.use({ viewport: size });

    test("a changed document names each stylesheet once with the page copy", async ({
      page,
    }) => {
      await page.goto(`${fixture.url}/view/example/handbook/`);
      await expect(headStatus(page)).toHaveText("Changed");
      await expect(
        page.locator(
          "#mb-main [data-diff-screen], #mb-main [data-viewport-option], .mbk-cmp-toolbar",
        ),
      ).toHaveCount(0);
      const evidence = await openPageEvidence(page);
      await expect(evidence.locator("h3")).toHaveText(["Comparison details"]);
      await expect(evidence).toContainText(
        "Compared with the branch point on main.",
      );
      await expect(
        evidence.getByText(PAGE_FILES_LEAD, { exact: true }),
      ).toBeVisible();
      expect(await evidenceFiles(evidence)).toEqual(HANDBOOK_FILES);
      expect(await evidenceSpacing(evidence)).toMatchObject({
        sentence: "8px",
        styles: "8px",
        afterList: "14px",
      });
      await expect(evidence).not.toContainText(
        /Changed component|Shared component changes|this screen|saved view|[0-9a-f]{64}/,
      );
      await expect(page.locator(".mbk-screen-head")).not.toContainText(
        /\.action|article h2|:root|\.css/,
      );
    });

    test("the shell repeats the approved document mockup's layout and copy", async ({
      page,
    }) => {
      await page.goto(`${fixture.url}/view/example/handbook/`);
      const evidence = await openPageEvidence(page);
      const served = await evidenceFiles(evidence);
      const spacing = await evidenceSpacing(evidence);
      await expect(page.locator("#mb-main h2")).toHaveText("Getting started");
      expect(await titleLines(page)).toBe(1);
      await page.goto(documentDesignUrl(name));
      const card = page.locator(".mbk-comparison-details");
      await expect(
        card.getByText(PAGE_FILES_LEAD, { exact: true }),
      ).toBeVisible();
      const approved = await evidenceFiles(card);
      expect(served.map(([, outcomes]) => outcomes)).toEqual(
        approved.map(([, outcomes]) => outcomes),
      );
      expect(await evidenceSpacing(card)).toMatchObject({
        sentence: spacing.sentence,
        styles: spacing.styles,
        afterList: spacing.afterList,
      });
      await expect(
        page.locator(".mbk-screen-head .ce-change-status"),
      ).toHaveText("Changed");
      expect(await titleLines(page)).toBe(1);
    });

    test("an unchanged document lists its examined stylesheet and ends with its terminal line", async ({
      page,
    }) => {
      await page.goto(`${fixture.url}/view/notes/`);
      await expect(headStatus(page)).toHaveText("Unmodified");
      const evidence = await openPageEvidence(page);
      await expect(evidence.locator("p")).toHaveText([
        "Compared with the branch point on main.",
        PAGE_EXCLUDED_LEAD,
        "Examined and excluded:",
        PAGE_TERMINAL,
      ]);
      await expect(evidence.locator("li")).toHaveText(["mockups/notes.css"]);
      await expect(evidence.locator(".mbk-evidence-files")).toHaveCount(0);
    });
  });
}

test.describe("whole-document page evidence on a short screen", () => {
  test.use({ viewport: { width: 390, height: 640 } });

  test("the open Details scroll to the last style and keep the document in view", async ({
    page,
  }) => {
    await page.goto(`${fixture.url}/view/example/handbook/`);
    const evidence = await openPageEvidence(page);
    const last = evidence.locator("code").last();
    await expect(last).toHaveText(":root");
    await page.locator("[data-mokly-details]").hover();
    await page.mouse.wheel(0, 2000);
    await expect(last).toBeInViewport();
    const stage = await page.locator(".mbk-stage-embed").boundingBox();
    expect(stage?.height ?? 0).toBeGreaterThan(100);
  });
});

test.describe("whole-document page evidence across navigation", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Changes lists the document and its Details keep the same facts", async ({
    page,
  }) => {
    await page.goto(`${fixture.url}/view/example/handbook/`);
    const facts = await evidenceFiles(await openPageEvidence(page));
    await page.locator('[data-filter="changed"]').click();
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("3");
    await expect(
      page.locator('[data-entry-id="example/handbook"]'),
    ).toBeVisible();
    await expect(page.locator('[data-entry-id="notes"]')).toBeHidden();
    expect(await evidenceFiles(page.locator("[data-page-evidence]"))).toEqual(
      facts,
    );
    await page.locator('[data-entry-id="action"]').click();
    await expect(page.locator("#mb-main h2")).toHaveText("Action");
    await page.locator('[data-entry-id="example/handbook"]').click();
    await expect(page.locator("#mb-main h2")).toHaveText("Getting started");
    await expect(headStatus(page)).toHaveText("Changed");
    expect(await evidenceFiles(await openPageEvidence(page))).toEqual(facts);
  });
});

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
