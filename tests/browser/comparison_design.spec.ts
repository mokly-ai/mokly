import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

const design = (entryPath: string, viewport: string): string =>
  pathToFileURL(
    path.join(
      repositoryRoot,
      "examples/basic/generated",
      entryPath,
      `index.${viewport}.html`,
    ),
  ).href;

test("stylesheet and empty Changes filters preserve their depicted catalogue", async ({
  page,
}) => {
  await page.goto(
    design("design/changes/impact/styles/matched-excluded/excluded", "desktop"),
  );
  await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(
    /design\/changes\/impact\/styles\/matched-excluded\/matched\/index\.desktop\.html$/,
  );
  await expect(page.locator(".mbk-nav-filter-opt.active")).toHaveText(
    "Changes1",
  );
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(
    /design\/changes\/impact\/styles\/matched-excluded\/excluded\/index\.desktop\.html$/,
  );

  await page.goto(design("design/changes/impact/ignored-only", "desktop"));
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(
    /design\/changes\/impact\/empty\/index\.desktop\.html$/,
  );
  await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(
    /design\/changes\/impact\/ignored-only\/index\.desktop\.html$/,
  );
});

test("Excluded styles shows changed Welcome controls in both artboards", async ({
  page,
}) => {
  for (const viewport of ["mobile", "desktop"] as const) {
    await page.goto(
      design(
        "design/changes/impact/styles/matched-excluded/excluded",
        viewport,
      ),
    );
    await expect(page.locator('[data-change-status="changed"]')).toHaveText(
      "Changed",
    );
    const controls = page.getByRole("group", { name: "Comparison mode" });
    await expect(controls).toBeVisible();
    await expect(controls.locator(".active")).toHaveText("Current");
    await expect(controls).toContainText("Side by side");
    await expect(controls).toContainText("Overlay");
    await expect(controls).toContainText("Difference");
    if (viewport === "desktop")
      await expect(
        page.locator(".mbk-nav-row.active .mbk-nav-changed-text"),
      ).toHaveText("Changed");
  }
});

test("Excluded styles opens Details as Excluded styles only, which returns through Welcome", async ({
  page,
}) => {
  const row = (id: string) =>
    page.locator(`a.mbk-nav-row[data-mokly-link="${id}"]`);
  await page.goto(
    design("design/changes/impact/styles/matched-excluded/excluded", "desktop"),
  );
  await row(
    "design/changes/impact/styles/matched-excluded/excluded-only",
  ).click();
  await expect(page).toHaveURL(
    /design\/changes\/impact\/styles\/matched-excluded\/excluded-only\/index\.desktop\.html$/,
  );
  for (const viewport of ["desktop", "mobile"] as const) {
    if (viewport === "mobile")
      await page.goto(
        design(
          "design/changes/impact/styles/matched-excluded/excluded-only",
          viewport,
        ),
      );
    await expect(page.locator(".mbk-screen-head h2")).toHaveText("Details");
    await expect(page.locator('[data-change-status="unmodified"]')).toHaveText(
      "Unmodified",
    );
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await expect(page.locator(".mbk-comparison-stage")).toHaveCount(0);
    await expect(page.locator(".mbk-comparison-details")).toContainText(
      /Examined and excluded:\s*generated\/excluded\.css\s*No changes to this screen\.$/,
    );
    if (viewport === "desktop") {
      await expect(page.locator(".mbk-nav-filter-opt.active")).toHaveText(
        "All",
      );
      await expect(page.locator("a.mbk-nav-filter-opt")).toHaveCount(0);
      await row(
        "design/changes/impact/styles/matched-excluded/excluded",
      ).click();
      await expect(page).toHaveURL(
        /design\/changes\/impact\/styles\/matched-excluded\/excluded\/index\.desktop\.html$/,
      );
    }
  }
});

test("flow designs keep comparisons on the owning screens", async ({
  page,
}) => {
  for (const viewport of ["desktop", "mobile"]) {
    await page.goto(design("design/browse/views/use-case", viewport));
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
    "impact/styles/matched-excluded/matched",
  ]) {
    for (const viewport of ["desktop", "mobile"]) {
      await page.goto(design(`design/changes/${route}`, viewport));
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
      if (route === "impact/styles/matched-excluded/matched") {
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
      if (
        route === "impact/styles/matched-excluded/matched" &&
        viewport === "desktop"
      ) {
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
      design("design/changes/outcomes/previous-version/no-view", viewport),
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
    await page.goto(design("design/changes/impact/empty", viewport));
    await expect(page.locator(".mbk-screen-head h2")).toHaveText("Welcome");
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
  }
});
