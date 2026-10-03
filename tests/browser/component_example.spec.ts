import { expect, test } from "@playwright/test";

import { chooseScheme, chooseViewport } from "./workspace_actions.js";

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: the basic component catalogue edits real provider-backed components and exposes consumers`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1280, height: 900 }
        : { width: 390, height: 844 },
    );
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(response.url());
    });
    await page.goto("/view/example/components/action/");
    await chooseViewport(page, viewport);
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    if (viewport === "mobile")
      await page
        .getByRole("button", { name: "Expand inspector", exact: true })
        .click();
    const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
    await page.getByLabel("Label", { exact: true }).fill("Ready to continue");
    await expect(
      frame.getByRole("button", { name: "Ready to continue", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Corner radius", { exact: true }).fill("24");
    await expect(
      frame.getByRole("button", { name: "Ready to continue", exact: true }),
    ).toHaveCSS("border-radius", "24px");
    await chooseScheme(page, "dark");
    await expect(frame.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark",
    );
    await expect(
      frame.getByRole("button", { name: "Ready to continue", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `.context/component-example-${viewport}.png`,
    });
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    const usage = page
      .getByRole("tabpanel", { name: "Usage", exact: true })
      .locator(".mbk-usage-list")
      .first();
    for (const title of ["Welcome", "Details", "Toolbar · Default"])
      await expect(
        usage.getByRole("link", { name: title, exact: true }),
      ).toBeVisible();
    await usage
      .getByRole("link", {
        name: "Toolbar · Default",
        exact: true,
      })
      .click();
    await expect(frame.locator(".example-toolbar")).toHaveCSS(
      "border-radius",
      "12px",
    );
    await page
      .getByRole("tab", { name: "Nested components", exact: true })
      .click();
    await expect(page.locator("[data-instance-key]")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Highlight components", exact: true })
      .click();
    await expect(page.locator("[data-workspace-highlight]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(failures).toEqual([]);
  });
