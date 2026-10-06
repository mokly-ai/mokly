import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: controls keep the saved component canvas width`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    await page.goto(componentDesignUrl("design/components/overview", viewport));
    const saved = await page.locator(".ce-canvas:visible").boundingBox();
    await page.goto(
      componentDesignUrl("design/components/controls/controls", viewport),
    );
    const editable = await page.locator(".ce-canvas:visible").boundingBox();
    expect(editable?.width).toBe(saved?.width);
    const label = page.getByRole("textbox", { name: "label", exact: true });
    await label.fill("Next");
    await expect(label).toHaveValue("Next");
    for (const route of [
      "editing/variant",
      "editing/reset",
      "published/readonly-variant",
    ]) {
      await page.goto(
        componentDesignUrl(`design/components/controls/${route}`, viewport),
      );
      await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
    }
  });

  test(`${viewport}: the native checkbox reveals the optional hint`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    await page.goto(
      componentDesignUrl("design/components/controls/editing/unset", viewport),
    );
    await expect(
      page.getByRole("textbox", { name: "hint", exact: true }),
    ).toBeHidden();
    await page.getByRole("checkbox", { name: "Set hint", exact: true }).check();
    await expect(
      page.getByRole("textbox", { name: "hint", exact: true }),
    ).toBeVisible();
  });
}
