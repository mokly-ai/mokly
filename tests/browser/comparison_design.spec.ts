import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

const designIds: Readonly<Record<string, string>> = {
  "browse/views/use-case": "design-browse-use-case",
  "review/outcomes/changed": "design-review-changed",
  "review/outcomes/added": "design-review-added",
  "review/outcomes/removed": "design-review-removed",
  "review/outcomes/difference": "design-review-difference",
  "review/impact/stylesheets/excluded": "design-review-style-excluded",
  "review/impact/stylesheets/excluded-only":
    "design-review-style-excluded-only",
  "review/impact/stylesheets/matched": "design-review-style-matched",
  "review/impact/ignored-only": "design-review-ignored-only",
  "review/outcomes/previous-version/no-captured-view":
    "design-review-removed-no-view",
  "review/impact/empty": "design-review-empty",
};
const design = (route: string): string => {
  const match = /^(.*)\.(mobile|desktop)\.html$/u.exec(route);
  const id = match && designIds[match[1] ?? ""];
  if (!match || !id) throw new Error(`Unknown comparison design: ${route}`);
  return pathToFileURL(
    path.join(
      repositoryRoot,
      `examples/basic/generated/screens/${id}.${match[2]}.html`,
    ),
  ).href;
};

test("stylesheet and empty Changes filters preserve their depicted catalogue", async ({
  page,
}) => {
  await page.goto(design("review/impact/stylesheets/excluded.desktop.html"));
  await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(
    /screens\/design-review-style-matched\.desktop\.html$/,
  );
  await expect(page.locator(".mbk-nav-filter-opt.active")).toHaveText(
    "Changes1",
  );
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(
    /screens\/design-review-style-excluded\.desktop\.html$/,
  );

  await page.goto(design("review/impact/ignored-only.desktop.html"));
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(/screens\/design-review-empty\.desktop\.html$/);
  await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
  await page.locator("a.mbk-nav-filter-opt").click();
  await expect(page).toHaveURL(
    /screens\/design-review-ignored-only\.desktop\.html$/,
  );
});

test("Excluded styles shows changed Welcome controls in both artboards", async ({
  page,
}) => {
  for (const viewport of ["mobile", "desktop"] as const) {
    await page.goto(
      design(`review/impact/stylesheets/excluded.${viewport}.html`),
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
  await page.goto(design("review/impact/stylesheets/excluded.desktop.html"));
  await row("design-review-style-excluded-only").click();
  await expect(page).toHaveURL(
    /screens\/design-review-style-excluded-only\.desktop\.html$/,
  );
  for (const viewport of ["desktop", "mobile"] as const) {
    if (viewport === "mobile")
      await page.goto(
        design(`review/impact/stylesheets/excluded-only.${viewport}.html`),
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
      await row("design-review-style-excluded").click();
      await expect(page).toHaveURL(
        /screens\/design-review-style-excluded\.desktop\.html$/,
      );
    }
  }
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
