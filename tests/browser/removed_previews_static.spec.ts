/**
 * Previous versions of removed entries in the copied comparison output, under
 * the removed previews contract. In a wide window, a removed page, document,
 * and screen open as the section of their previous versions on the canvas,
 * with the Removed status and without comparison controls. In a narrow and a
 * wide window, each previous version comes from its generation, read once,
 * and the compact layout reads the Mobile column's documents alone. A viewport
 * that has no captured previous view holds its note in its frame's place,
 * which names the viewport that has one while no frame of it shows. Under
 * Dark, a screen captured only in Light keeps its Light row alone.
 */

import { expect, type Page } from "@playwright/test";

import { readCatalogueIndex, readEntryDetail } from "@mokly/viewer";

import { accentColor } from "../helpers/comparison_catalogue.js";

import { expectNoComparison } from "./comparison_absence.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  comparisonIndex,
  snapshotOf,
  type ComparisonIndex,
} from "./comparison_ui.js";
import {
  historicalFrame,
  PREVIOUS as STAGE,
  previousVersionLabel,
} from "./previous_version.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

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
  // The section's head holds the Removed status and the quiet label, or in
  // the compact layout, whose section has no head, the entry bar does.
  await expect(previousVersionLabel(page)).toHaveText(
    "Showing previous version",
  );
  await expect(
    page
      .locator(`${STAGE}, [data-entry-bar]`)
      .getByText("Removed", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator("#mb-main")).not.toContainText("was removed");
  await awaitRoutedDetail(page, entryPath);
  await expectNoComparison(page);
}

/** The historical document of a removed screen's Light frame of a viewport. */
function screenFrame(page: Page, viewport: "desktop" | "mobile") {
  return historicalFrame(page, viewport).locator("iframe").contentFrame();
}

test.describe("1280px window", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

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
    // Each frame, a bare canvas frame of its viewport, shows its own
    // viewport's previous document.
    for (const viewport of ["mobile", "desktop"] as const) {
      await expect(historicalFrame(page, viewport)).toHaveAttribute(
        "data-canvas-frame",
        viewport,
      );
      await expect(screenFrame(page, viewport).locator("h1")).toHaveText(
        "Historical screen",
      );
      await expect(
        historicalFrame(page, viewport).locator("iframe"),
      ).toHaveAttribute(
        "data-mokly-preview-source",
        new RegExp(
          `/snapshots/before/mokly-generated/${comparisonPaths.removedScreen}/index\\.${viewport}\\.html$`,
          "u",
        ),
      );
    }
    // Desktop stands beside Mobile, in one row, on the fitted canvas.
    const desktop = await historicalFrame(page, "desktop").boundingBox();
    const mobile = await historicalFrame(page, "mobile").boundingBox();
    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(desktop!.x + desktop!.width).toBeLessThan(mobile!.x);
    expect(Math.abs(desktop!.y - mobile!.y)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("group", { name: "Zoom" })).toBeVisible();
    await chooseViewport(page, "mobile");
    await expect(historicalFrame(page, "desktop")).toHaveCount(0);
    await expect(screenFrame(page, "mobile").locator("h1")).toHaveText(
      "Historical screen",
    );
    await expect(page.locator("[data-workspace-highlight]")).toBeDisabled();
    await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(0);
  });
});

for (const width of [390, 1280])
  test.describe(`${width}px window`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("each previous version is read once from its generation", async ({
      page,
      request,
      baseURL,
    }) => {
      const index = await comparisonIndex(request, baseURL);
      const generation = new URL(index.comparisonUrl, baseURL).pathname;
      const paths: string[] = [];
      page.on("request", (sent) => paths.push(new URL(sent.url()).pathname));
      await openRemoved(page, index, comparisonPaths.removedPage);
      await expect(
        page.frameLocator(`${STAGE} iframe`).locator("h1"),
      ).toHaveText("Historical page");
      await openRemoved(page, index, comparisonPaths.removedScreen);
      // The compact layout shows the Mobile frame alone, and the preview
      // reads the documents of the Mobile column's frames.
      const shown =
        width < 900 ? (["mobile"] as const) : (["desktop", "mobile"] as const);
      for (const viewport of shown)
        await expect(screenFrame(page, viewport).locator("h1")).toHaveText(
          "Historical screen",
        );
      // The page's preview reads its preview file once. The screen's preview
      // uses the removed detail that the route reads once for Details too.
      for (const [file, reads] of [
        [`previews/${comparisonPaths.removedPage}/index.json`, 1],
        [`entries/${comparisonPaths.removedScreen}.json`, 1],
      ] as const)
        expect(
          paths.filter((path) => path === `${generation}${file}`),
        ).toHaveLength(reads);
      // Each previous document is read once, from the generation's Before
      // side: the page's, and one for each frame of the screen's section,
      // whose Light row stands above its Dark row: both columns on the wide
      // canvas, and the Mobile column in the compact layout.
      const before = `${generation}snapshots/before/mokly-generated`;
      const screen = (file: string) =>
        `${before}/${comparisonPaths.removedScreen}/${file}`;
      const desktop = ["index.desktop.dark.html", "index.desktop.html"];
      expect(paths.filter((path) => path.endsWith(".html")).sort()).toEqual([
        `${before}/${comparisonPaths.removedPage}/index.html`,
        ...(width < 900 ? [] : desktop.map(screen)),
        screen("index.mobile.dark.html"),
        screen("index.mobile.html"),
      ]);
    });
  });

test("a viewport with no captured previous view says so", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  // Both records describe a generation with only desktop views.
  await page.route("**/mokly-viewer/index.json", async (route) => {
    const response = await route.fetch();
    const model = readCatalogueIndex(await response.json());
    const entry = model.removedEntries
      .map(({ entry }) => entry)
      .find((entry) => entry.path === comparisonPaths.removedScreen);
    if (entry?.kind !== "screen") throw new Error("Missing removed screen");
    entry.views = entry.views.filter((view) => view.viewport !== "mobile");
    await route.fulfill({ response, json: model });
  });
  await page.route(
    `**/${index.comparisonUrl}entries/${comparisonPaths.removedScreen}.json`,
    async (route) => {
      const response = await route.fetch();
      const detail = readEntryDetail(await response.json());
      detail.views = detail.views.filter((view) => view.viewport !== "mobile");
      await route.fulfill({ response, json: detail });
    },
  );
  const note = `${STAGE} .mbk-preview-note`;
  const rest = `${note} .mbk-preview-switch`;
  await openRemoved(page, index, comparisonPaths.removedScreen);
  await expect(screenFrame(page, "desktop").locator("h1")).toHaveText(
    "Historical screen",
  );
  // The note stands where each Mobile frame would stand, in the Light row
  // and the Dark row, under the frame's label, with no document and no size
  // tag. Its second sentence is hidden while the Desktop frames show.
  for (const [scheme, label] of [
    ["light", "Mobile · Light"],
    ["dark", "Mobile · Dark"],
  ] as const) {
    const place = historicalFrame(page, "mobile", scheme);
    await expect(place.locator("iframe")).toHaveCount(0);
    await expect(place.locator("figcaption")).toHaveText(label);
    await expect(place.locator(".mbk-preview-note")).toContainText(
      "No previous mobile version was captured.",
    );
    await expect(place.locator(".mbk-preview-switch")).toBeHidden();
  }
  await expect(page.locator(rest)).toHaveCount(2);

  await chooseViewport(page, "mobile");
  await expect(page.locator(`${STAGE} iframe`)).toHaveCount(0);
  const full =
    "No previous mobile version was captured. Switch to Desktop to see it.";
  await expect(page.locator(note)).toHaveText([full, full]);
  for (const sentence of await page.locator(rest).all())
    await expect(sentence).toBeVisible();

  await chooseViewport(page, "desktop");
  await expect(page.locator(note)).toHaveCount(0);
  await expect(screenFrame(page, "desktop").locator("h1")).toHaveText(
    "Historical screen",
  );
});

test("under Dark, a removed screen captured only in Light keeps its Light row alone", async ({
  page,
  request,
  baseURL,
}) => {
  const entryPath = comparisonPaths.removedLightOnly;
  await openRemoved(page, await comparisonIndex(request, baseURL), entryPath);
  await chooseViewport(page, "desktop");
  await chooseScheme(page, "dark");
  await expect(page.locator(`${STAGE} figure`)).toHaveCount(1);
  await expect(historicalFrame(page, "desktop", "dark")).toHaveCount(0);
  await expect(historicalFrame(page, "desktop")).toHaveAttribute(
    "data-preview-color-scheme",
    "light",
  );
  await expect(
    historicalFrame(page, "desktop").locator("iframe"),
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
