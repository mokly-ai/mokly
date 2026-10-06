import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

test("comparison designs use screen context instead of report chrome", async ({
  page,
}) => {
  for (const route of [
    "outcomes/changed",
    "outcomes/added",
    "outcomes/removed",
    "outcomes/difference",
    "impact/shared-impact",
    "impact/ignored-only",
  ]) {
    for (const viewport of ["desktop", "mobile"] as const) {
      await page.goto(designArtboardUrl(`design/changes/${route}`, viewport));
      const comparisonDetails = page.getByText("Comparison details", {
        exact: true,
      });
      if (route === "outcomes/added") {
        await expect(comparisonDetails).toBeHidden();
        await page
          .getByRole("button", { name: "Details", exact: true })
          .click();
        await expect(
          page.getByText("Added to this branch.", { exact: true }),
        ).toBeVisible();
      }
      await expect(comparisonDetails).toBeVisible();
      if (route === "outcomes/removed")
        await expect(
          page.getByText("Farewell was removed from the catalogue.", {
            exact: true,
          }),
        ).toBeVisible();
      await expect(page.locator(".mbk-nav .mbk-nav-resize")).toHaveCount(
        viewport === "desktop" ? 1 : 0,
      );
      await expect(page.locator(".ce-inspector-resize:visible")).toHaveCount(
        viewport === "desktop" ? 1 : 0,
      );
      const frame = page
        .locator(viewport === "desktop" ? ".browser-frame" : ".phone-frame")
        .first();
      await expect(frame).toBeVisible();
    }
  }
});

test("a viewport with no previous view names the one that still opens", async ({
  page,
}) => {
  for (const viewport of ["desktop", "mobile"] as const) {
    await page.goto(
      designArtboardUrl(
        "design/changes/outcomes/previous-version/no-view",
        viewport,
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
