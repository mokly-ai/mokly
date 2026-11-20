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

test("the phone catalogue drawer uses the full remaining window height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const made = await publishedProject(page, "viewer-height-phone");
  await makePublic(page, made.projectId);
  await open(page, made.publicationPath);
  await publishedViewerReady(page);

  const viewer = page.locator("[data-mokly-shell]");
  await viewer
    .getByRole("button", { name: "Open catalogue navigation" })
    .click();
  const drawer = viewer.getByRole("navigation", { name: "Catalogue" });
  await expect(drawer).toBeVisible();

  // The tree's scroll area has no accessible name. Its bottom must follow
  // the drawer, so a tall frame cannot hide a short, unusable tree.
  for (const area of [drawer, drawer.locator("[data-mokly-nav-scroll]")]) {
    await expect
      .poll(async () => {
        const box = await area.boundingBox();
        return box === null ? null : Math.round(box.y + box.height);
      }, "the catalogue drawer and its scroll area reach the window bottom")
      .toBe(844);
  }

  await drawer.getByRole("link", { name: /^Start( Changed)?$/ }).click();
  await expect(
    viewer.getByRole("heading", { level: 2, name: "Start" }),
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

    for (const width of [1024, 768]) {
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
