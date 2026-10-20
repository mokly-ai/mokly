/**
 * Previous versions of removed entries in the copied comparison output, under
 * the removed previews contract. In a narrow and a wide window, a removed
 * page, document, and screen show their previous versions with the Removed
 * status and without comparison controls. Each previous version comes from
 * its generation, read once. A viewport that has no captured previous view
 * says so and names the viewport that has one. Under Dark, a screen captured
 * only in Light shows its light views and names them Light only.
 */

import { expect, type Page } from "@playwright/test";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  comparisonIndex,
  snapshotOf,
  type ComparisonIndex,
} from "./comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const STAGE = "[data-mokly-preview]";
const DOCUMENTS = [
  [comparisonPaths.removedPage, "Historical page"],
  [comparisonPaths.removedDocument, "Historical document"],
] as const;

/** Open a removed entry's previous version through its canonical route. */
async function openRemoved(
  page: Page,
  index: ComparisonIndex,
  entryPath: string,
): Promise<void> {
  await page.goto(
    `/view/${entryPath}/?snapshot=${snapshotOf(index, entryPath)}`,
  );
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(page.locator("#mb-main .mbk-entry-status")).toHaveText(
    "Removed",
  );
  await expect(page.locator("#mb-main")).not.toContainText("was removed");
  await expect(
    page.locator(
      "[data-diff-stage], [data-diff-mode], [data-diff-refresh], .mbk-diff-toolbar",
    ),
  ).toHaveCount(0);
}

function screenFrame(page: Page, viewport: "desktop" | "mobile") {
  return page.frameLocator(`${STAGE} .mbk-frame-${viewport} iframe`);
}

for (const width of [390, 1280])
  test.describe(`${width}px window`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("a removed page and document show their previous versions", async ({
      page,
      request,
      baseURL,
    }) => {
      const index = await comparisonIndex(request, baseURL);
      for (const [entryPath, heading] of DOCUMENTS) {
        await openRemoved(page, index, entryPath);
        await expect(page.locator(`${STAGE} iframe`)).toHaveCount(1);
        await expect(
          page.frameLocator(`${STAGE} iframe`).locator("h1"),
        ).toHaveText(heading);
      }
      // The base stylesheet still styles a previous version: the card that
      // screens/former used keeps the Before colour, not the current one.
      await openRemoved(page, index, comparisonPaths.removedLightOnly);
      await expect(
        screenFrame(page, "desktop").locator("article.accent"),
      ).toHaveCSS("color", accentColor.Before);
    });

    test("a removed screen shows its previous frames", async ({
      page,
      request,
      baseURL,
    }) => {
      await openRemoved(
        page,
        await comparisonIndex(request, baseURL),
        comparisonPaths.removedScreen,
      );
      await expect(page.locator(`${STAGE} .phone-frame`)).toHaveCount(1);
      await expect(page.locator(`${STAGE} .browser-frame`)).toHaveCount(1);
      // Each frame shows its own viewport's previous document.
      for (const viewport of ["desktop", "mobile"] as const) {
        await expect(screenFrame(page, viewport).locator("h1")).toHaveText(
          "Historical screen",
        );
        await expect(
          page.locator(`${STAGE} .mbk-frame-${viewport} iframe`),
        ).toHaveAttribute(
          "data-mokly-preview-source",
          new RegExp(
            `/snapshots/before/mokly-generated/${comparisonPaths.removedScreen}/index\\.${viewport}\\.html$`,
            "u",
          ),
        );
      }
      await chooseViewport(page, "mobile");
      await expect(page.locator(`${STAGE} .browser-frame`)).toHaveCount(0);
      await expect(screenFrame(page, "mobile").locator("h1")).toHaveText(
        "Historical screen",
      );
      await expect(page.locator("[data-workspace-highlight]")).toBeDisabled();
      await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
    });

    test("each previous version is read once from its generation", async ({
      page,
      request,
      baseURL,
    }) => {
      const index = await comparisonIndex(request, baseURL);
      const generation = new URL(index.comparisonUrl, baseURL).pathname.replace(
        /review\.json$/u,
        "",
      );
      const paths: string[] = [];
      page.on("request", (sent) => paths.push(new URL(sent.url()).pathname));
      await openRemoved(page, index, comparisonPaths.removedPage);
      await expect(
        page.frameLocator(`${STAGE} iframe`).locator("h1"),
      ).toHaveText("Historical page");
      await openRemoved(page, index, comparisonPaths.removedScreen);
      for (const viewport of ["desktop", "mobile"] as const)
        await expect(screenFrame(page, viewport).locator("h1")).toHaveText(
          "Historical screen",
        );
      // The page reads its preview file once and the screen the review once.
      for (const file of [
        `previews/${comparisonPaths.removedPage}/index.json`,
        "review.json",
      ])
        expect(paths.filter((path) => path === `${generation}${file}`)).toEqual(
          [`${generation}${file}`],
        );
      // Each previous document is read once, from the generation's Before side.
      const before = `${generation}snapshots/before/mokly-generated`;
      expect(paths.filter((path) => path.endsWith(".html")).sort()).toEqual([
        `${before}/${comparisonPaths.removedPage}/index.html`,
        `${before}/${comparisonPaths.removedScreen}/index.desktop.html`,
        `${before}/${comparisonPaths.removedScreen}/index.mobile.html`,
      ]);
    });
  });

/** Only the fields that this case rewrites; the rest passes through. */
interface CapturedReview {
  entries: { kind: string; path: string; views: { viewport: string }[] }[];
}

test("a viewport with no captured previous view says so", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  // Deliver the review as if the removed screen had only desktop views.
  await page.route(`**/${index.comparisonUrl}`, async (route) => {
    const response = await route.fetch();
    const review = (await response.json()) as CapturedReview;
    for (const entry of review.entries)
      if (entry.path === comparisonPaths.removedScreen)
        entry.views = entry.views.filter((view) => view.viewport !== "mobile");
    await route.fulfill({ response, json: review });
  });
  const note = `${STAGE} .mbk-preview-note`;
  const rest = `${note} .mbk-preview-switch`;
  await openRemoved(page, index, comparisonPaths.removedScreen);
  await expect(screenFrame(page, "desktop").locator("h1")).toHaveText(
    "Historical screen",
  );
  await expect(page.locator(`${STAGE} .mbk-frame-mobile`)).toHaveCount(0);
  await expect(page.locator(note)).toContainText(
    "No previous mobile version was captured.",
  );
  await expect(page.locator(rest)).toBeHidden();

  await chooseViewport(page, "mobile");
  await expect(page.locator(`${STAGE} iframe`)).toHaveCount(0);
  await expect(page.locator(note)).toHaveText(
    "No previous mobile version was captured. Switch to Desktop to see it.",
  );
  await expect(page.locator(rest)).toBeVisible();

  await chooseViewport(page, "desktop");
  await expect(page.locator(note)).toHaveCount(0);
  await expect(screenFrame(page, "desktop").locator("h1")).toHaveText(
    "Historical screen",
  );
});

test("Dark falls back to the light views a removed screen kept only", async ({
  page,
  request,
  baseURL,
}) => {
  const entryPath = comparisonPaths.removedLightOnly;
  await openRemoved(page, await comparisonIndex(request, baseURL), entryPath);
  await chooseViewport(page, "desktop");
  await chooseScheme(page, "dark");
  await expect(
    page.locator(`${STAGE} .mbk-frame-desktop[data-color-scheme-fallback]`),
  ).toHaveCount(1);
  await expect(page.locator(`${STAGE} .mbk-frame-label`)).toHaveText(
    "Desktop — Light only",
  );
  await expect(
    page.locator(`${STAGE} .mbk-frame-desktop iframe`),
  ).toHaveAttribute(
    "data-mokly-preview-source",
    new RegExp(
      `/snapshots/before/mokly-generated/${entryPath}/index\\.desktop\\.html$`,
      "u",
    ),
  );
  await expect(screenFrame(page, "desktop").locator("h1")).toHaveText(
    "Former screen",
  );
});
