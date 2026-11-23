import type { Locator, Page } from "@playwright/test";

import { expect, open, test } from "../harness";

import { taggedLayoutFixture } from "./layout-fixture";
import { expectReadableBar, verticalCentreDifference } from "./layout-geometry";
import { makePublic, publishedProject, publishedViewerReady } from "./support";

/** Layout has no text state, so measure the visible package shell. */
async function expectWindowHeight(viewer: Locator, height: number) {
  await expect
    .poll(async () => {
      const box = await viewer.boundingBox();
      return box === null
        ? null
        : { top: Math.round(box.y), bottom: Math.round(box.y + box.height) };
    }, "the hosted viewer spans the window from top to bottom")
    .toEqual({ top: 0, bottom: height });
}

async function expectNoDocumentScroll(page: Page) {
  await expect
    .poll(
      () =>
        page
          .locator("html")
          .evaluate((root) => root.scrollHeight - root.clientHeight),
      "the catalogue stays inside the window instead of scrolling the document",
    )
    .toBe(0);
}

test("a public viewer fills the desktop window in All and Changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const made = await publishedProject(page, "viewer-height-desktop");
  await makePublic(page, made.projectId);
  await open(page, made.publicationPath);
  await publishedViewerReady(page);

  const viewer = page.locator("[data-mokly-shell]");
  await expectWindowHeight(viewer, 900);
  await expectNoDocumentScroll(page);

  const changes = viewer.getByRole("button", { name: /^Changes/ });
  await changes.click();
  await expect(changes).toHaveAttribute("aria-pressed", "true");
  await expectWindowHeight(viewer, 900);
  await expectNoDocumentScroll(page);
});

test("the phone catalogue sheet's tree reaches the bottom of the sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const made = await publishedProject(page, "viewer-height-phone");
  await makePublic(page, made.projectId);
  await open(page, made.publicationPath);
  await publishedViewerReady(page);

  const viewer = page.locator("[data-mokly-shell]");
  await viewer
    .getByRole("group", { name: "Canvas controls" })
    .getByRole("button", { name: "Catalogue", exact: true })
    .click();
  const catalogue = viewer.getByRole("navigation", { name: "Catalogue" });
  await expect(catalogue).toBeVisible();

  // The sheet and the tree's scroll area have no accessible name. The sheet
  // opens at the window bottom, and the scroll area's bottom must follow the
  // sheet's, so a tall frame cannot hide a short, unusable tree.
  const sheet = viewer.locator("[data-floating-panel]", {
    has: page.getByRole("navigation", { name: "Catalogue" }),
  });
  for (const area of [sheet, catalogue.locator("[data-mokly-nav-scroll]")]) {
    await expect
      .poll(async () => {
        const box = await area.boundingBox();
        return box === null ? null : Math.round(box.y + box.height);
      }, "the catalogue sheet and its tree's scroll area reach the window bottom")
      .toBe(844);
  }

  await catalogue.getByRole("link", { name: /^Start( Changed)?$/ }).click();
  // The compact layout names the opened entry in its entry bar. The closed
  // panel sheet keeps its heading mounted and hidden.
  await expect(
    viewer.locator("[data-entry-bar]").getByText("Start", { exact: true }),
  ).toBeVisible();
  await expectWindowHeight(viewer, 844);
  await expectNoDocumentScroll(page);
});

test("the top bar keeps controls readable and follows its own width", async ({
  page,
}) => {
  const tagged = taggedLayoutFixture();
  try {
    const made = await publishedProject(page, "viewer-bar-layout", {
      branch: "main",
      fixture: tagged.path,
    });
    await makePublic(page, made.projectId);
    await open(page, made.publicationPath + "?catalogueScreen=start");
    await publishedViewerReady(page);
    const viewer = page.locator("[data-mokly-shell]");
    const more = viewer.getByRole("button", { name: "More", exact: true });
    const publication = viewer.getByTestId("viewer-publication");

    // Both widths are below the switch width, so the bar is compact.
    for (const width of [960, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await expectReadableBar(viewer);
      await expect
        .poll(
          () => verticalCentreDifference(more, publication),
          `More and publication share one centre line at ${width}px`,
        )
        .toBeLessThanOrEqual(1);
      const search = viewer.getByRole("searchbox", {
        name: "Search catalogue",
      });
      await search.fill("start");
      await expect(page).toHaveURL(/[?&]search=start(?:&|$)/);
      await search.clear();
      const tags = viewer.getByRole("button", { name: "Filter by tag" });
      await tags.click();
      await expect(
        viewer.getByRole("group", { name: "Tags", exact: true }),
      ).toBeVisible();
      await tags.click();
      await expect(
        viewer.getByRole("group", { name: "Tags", exact: true }),
      ).toBeHidden();
    }
    await expect(more).toBeVisible();

    await more.click();
    const menu = page.getByRole("menu", { name: "Viewer actions" });
    await expect(menu).toBeVisible();
    for (const label of [
      "Projects",
      "History",
      "Share",
      "Settings",
      "Account",
    ]) {
      await expect(menu.getByText(label, { exact: true })).toBeVisible();
    }
    await menu.getByText("History", { exact: true }).click();
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
    await page.getByTestId("close-history").click();

    await page.setViewportSize({ width: 1440, height: 900 });
    const history = viewer.getByRole("button", {
      name: "History",
      exact: true,
    });
    await expect(history).toBeVisible();
    const container = page.locator('[data-mkc-screen="viewer"]');
    // A host can allocate less space than the window. The app has no user
    // control for that arrangement, so resize only its own route container.
    await container.evaluate((element) => {
      element.style.width = "768px";
    });
    await expect(more).toBeVisible();
    await expect(history).toBeHidden();
    await expectReadableBar(viewer);
    await more.click();
    await expect(menu).toBeVisible();
    await menu.getByText("History", { exact: true }).click();
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
    await container.evaluate((element) =>
      element.style.removeProperty("width"),
    );
    // The modal hides its backdrop from accessibility. Include the rendered
    // control only to wait for the new composition before dismissal.
    await expect(
      viewer.getByRole("button", {
        name: "History",
        exact: true,
        includeHidden: true,
      }),
    ).toBeVisible();
    await page.getByTestId("close-history").click();
    await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
    await expect(
      history,
      "History opened from More returns to its direct control after widening",
    ).toBeFocused();
    await history.click();
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
    await container.evaluate((element) => {
      element.style.width = "768px";
    });
    await expect(
      viewer.getByRole("button", {
        name: "More",
        exact: true,
        includeHidden: true,
      }),
    ).toBeVisible();
    await page.getByTestId("close-history").click();
    await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
    await expect(
      more,
      "History opened directly returns to More after narrowing",
    ).toBeFocused();
    await container.evaluate((element) =>
      element.style.removeProperty("width"),
    );
    await expect(history).toBeVisible();
    await expect(more).toBeHidden();
    await expectReadableBar(viewer);
    await history.click();
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  } finally {
    tagged.dispose();
  }
});
