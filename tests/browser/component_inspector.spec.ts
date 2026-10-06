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

test("the shared inspector opens and closes inside sandboxed Browse frames", async ({
  page,
}) => {
  await page.goto("/view/design/components/overview/");
  for (const viewport of ["desktop", "mobile"] as const) {
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    const inspector = frame.getByRole("region", {
      name: "Inspector",
      exact: true,
    });
    await inspector.getByRole("button", { name: "Usage", exact: true }).click();
    await inspector.getByRole("button", { name: "Usage", exact: true }).click();
    await expect(inspector.locator(":scope > details[open]")).toHaveCount(0);
    await expect(frame.locator("script")).toHaveCount(1);
    await expect(frame.locator("script")).toHaveAttribute(
      "src",
      "/__mokly/client/inspector.js",
    );
  }
});
