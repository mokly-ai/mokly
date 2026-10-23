import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
test("catalogue separates specs and components into collapsible sections", async ({
  page,
}) => {
  await page.goto("/");
  const specs = page.locator('[data-nav-section="specs"]');
  const components = page.locator('[data-nav-section="components"]');
  await expect(specs.locator(":scope > summary")).toHaveText("Specs");
  await expect(components.locator(":scope > summary")).toHaveText("Components");
  await expect(specs).toHaveAttribute("open", "");
  await expect(components).toHaveAttribute("open", "");
  await expect(specs.locator('[data-entry-kind="component"]')).toHaveCount(0);
  await expect(
    components.locator(':not([data-entry-kind="component"])[data-nav-row]'),
  ).toHaveCount(0);
  expect(await specs.locator("[data-nav-row]").count()).toBeGreaterThan(0);
  expect(await components.locator("[data-nav-row]").count()).toBeGreaterThan(0);

  await components.locator(":scope > summary").click();
  await expect(components).not.toHaveAttribute("open", "");
  await page.reload();
  await expect(specs).toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");

  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(specs).not.toHaveAttribute("open", "");
  await expect(components).not.toHaveAttribute("open", "");
});
