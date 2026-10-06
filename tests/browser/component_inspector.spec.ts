import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: inspector icons open each panel with keyboard focus`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    await page.goto(
      componentDesignUrl("design/components/pages/toolbar", viewport),
    );
    const inspector = page.getByRole("region", {
      name: "Inspector",
      exact: true,
    });
    for (const name of ["Nested components", "Props", "Usage", "Details"]) {
      const icon = inspector.getByRole("button", { name, exact: true });
      await icon.focus();
      await expect(icon).toBeFocused();
      await page.keyboard.press("Space");
      await expect(inspector.locator(":scope > details[open]")).toHaveCount(1);
      await expect(
        inspector.getByRole("region", { name, exact: true }),
      ).toBeVisible();
    }
  });
}
