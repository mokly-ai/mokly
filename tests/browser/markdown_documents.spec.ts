import { expect, test } from "@playwright/test";

import { expectFrameSource } from "./workspace_actions.js";

for (const width of [390, 1280]) {
  test(`Markdown overview and guide open, link and change appearance at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/view/example/");
    await expect(page.locator("#mb-main h2")).toHaveText("Example");
    const frame = page.frameLocator(".mbk-stage-embed iframe");
    await expect(
      frame.getByRole("heading", { name: "Example", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".mbk-stage-embed iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "ready",
    );
    await frame.getByRole("link", { name: "Read the workspace guide" }).click();
    await expect(page).toHaveURL(
      /\/view\/example\/workspace-guide\/\?fragment=your-first-visit$/,
    );
    await expect(page.locator("#mb-main h2")).toHaveText("Workspace guide");
    await expect(frame.locator("#your-first-visit")).toBeVisible();
    await expect(frame.getByRole("img")).toBeVisible();
    expect(
      await frame
        .getByRole("img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);
    await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
    await expectFrameSource(
      page.locator(".mbk-stage-embed iframe"),
      /index\.dark\.html#your-first-visit$/,
    );
    await expect(frame.locator("html")).toHaveAttribute(
      "style",
      /color-scheme: dark/,
    );
    await frame.getByRole("link", { name: "Example overview" }).click();
    await expect(page).toHaveURL(/\/view\/example\/\?fragment=start-here$/);
    await expect(frame.locator("#start-here")).toBeVisible();
    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Workspace guide");
    await page.reload();
    await expect(page.locator(".mbk-stage-embed iframe")).toHaveAttribute(
      "data-mokly-frame-state",
      "ready",
    );
    await expectFrameSource(
      page.locator(".mbk-stage-embed iframe"),
      /index\.dark\.html#your-first-visit$/,
    );
    await expect(page.locator(".mbk-stage-embed iframe")).toHaveAttribute(
      "data-fragment-dark",
      /index\.dark\.html#your-first-visit$/,
    );
  });
}
