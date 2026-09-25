import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

const design = (route: string): string =>
  pathToFileURL(
    path.join(repositoryRoot, "examples/basic/generated/design", route),
  ).href;

test("stylesheet and empty Changes filters preserve their depicted catalogue", async ({
  page,
}) => {
  await page.goto(design("review/impact/stylesheets/excluded.desktop.html"));
  await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(/stylesheets\/matched\.desktop\.html$/);
  await expect(page.locator(".mbk-nav-filter-opt.active")).toHaveText(
    "Changes1",
  );
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(/stylesheets\/excluded\.desktop\.html$/);

  await page.goto(design("review/impact/ignored-only.desktop.html"));
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(/impact\/empty\.desktop\.html$/);
  await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(/impact\/ignored-only\.desktop\.html$/);
});

test("flow designs keep comparisons on the owning screens", async ({
  page,
}) => {
  for (const viewport of ["desktop", "mobile"]) {
    await page.goto(design(`browse/views/use-case.${viewport}.html`));
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await expect(page.locator(".flow-step-link")).toHaveCount(2);
  }
});

test("comparison designs use screen context instead of report chrome", async ({
  page,
}) => {
  for (const route of [
    "outcomes/changed",
    "outcomes/added",
    "outcomes/removed",
    "outcomes/difference",
    "impact/ignored-only",
    "impact/stylesheets/matched",
  ]) {
    for (const viewport of ["desktop", "mobile"]) {
      await page.goto(design(`review/${route}.${viewport}.html`));
      await expect(
        page.locator(".mbk-title-row .mbk-status, .mbk-review-summary"),
      ).toHaveCount(0);
      const comparisonDetails = page.getByText("Comparison details", {
        exact: true,
      });
      if (route === "outcomes/added") {
        await expect(
          page.locator('details[data-panel="info"]'),
        ).not.toHaveAttribute("open", "");
        await page
          .getByRole("button", { name: "Details", exact: true })
          .click();
        await expect(
          page.getByText("Added to this branch.", { exact: true }),
        ).toBeVisible();
      }
      await expect(comparisonDetails).toBeVisible();
      if (route === "impact/stylesheets/matched") {
        await expect(
          page.getByText("Changed styles that apply to this screen:"),
        ).toBeVisible();
        await expect(page.getByText("generated/styles.css")).toBeVisible();
      }
      if (route === "impact/ignored-only" && viewport === "desktop") {
        await expect(page.locator(".mbk-nav-filter-opt.active")).toHaveText(
          "All",
        );
        await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
      }
      if (route === "impact/stylesheets/matched" && viewport === "desktop") {
        await expect(page.locator(".mbk-nav-filter-opt.active")).toHaveText(
          "Changes1",
        );
      }
      await expect(page.locator(".mbk-nav .mbk-nav-resize")).toHaveCount(
        viewport === "desktop" ? 1 : 0,
      );
      await expect(page.locator(".ce-inspector-resize:visible")).toHaveCount(
        viewport === "desktop" ? 1 : 0,
      );
      if (route === "outcomes/removed") {
        await expect(page.locator("[data-change-status]")).toHaveText(
          "Removed",
        );
        await expect(
          page.getByText("Farewell was removed from the catalogue.", {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("group", { name: "Comparison mode" }),
        ).toHaveCount(0);
        await expect(page.locator(".mbk-previous")).toHaveText(
          "Showing previous version",
        );
        await expect(page.locator(".mbk-empty")).toHaveCount(0);
      }
      const frame = page
        .locator(viewport === "desktop" ? ".browser-frame" : ".phone-frame")
        .first();
      await expect(frame).toBeVisible();
      if (route === "outcomes/removed")
        await expect(frame).toContainText("Thanks for looking around");
    }
  }
});

test("a viewport with no previous view names the one that still opens", async ({
  page,
}) => {
  for (const viewport of ["desktop", "mobile"]) {
    await page.goto(
      design(
        `review/outcomes/previous-version/no-captured-view.${viewport}.html`,
      ),
    );
    await expect(page.locator("[data-change-status]")).toHaveText("Removed");
    await expect(page.locator(".mbk-previous")).toHaveText(
      "Showing previous version",
    );
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    const note = page.locator(".mbk-preview-note");
    const hint = page.locator(".mbk-preview-switch");
    const captured = page.locator(".ce-preview-view:visible .browser-frame");
    const selection = page.getByRole("combobox", { name: "Preview viewport" });
    await expect(selection).toHaveValue("mobile");
    await expect(note).toBeVisible();
    await expect(note).toHaveText(
      "No previous mobile version was captured. Switch to Desktop to see it.",
    );
    await expect(captured).toHaveCount(0);
    await selection.selectOption("both");
    await expect(hint).toBeHidden();
    await expect(note).toBeVisible();
    await expect(captured).toBeVisible();
    await selection.selectOption("desktop");
    await expect(note).toBeHidden();
    await expect(captured).toBeVisible();
  }
});

test("empty Changes designs retain the selected current screen", async ({
  page,
}) => {
  for (const viewport of ["desktop", "mobile"]) {
    await page.goto(design(`review/impact/empty.${viewport}.html`));
    await expect(page.locator(".mbk-screen-head h2")).toHaveText("Welcome");
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
  }
});
