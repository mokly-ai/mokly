import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`component usage links select the corresponding ${viewport} container or hidden instance`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    for (const [route, title, value] of [
      ["toolbar", "Toolbar", "Ready for your next step?"],
      ["help", "Help hint", "false"],
    ]) {
      await page.goto(componentDesignUrl(`pages/${route}`, viewport));
      await page.getByRole("button", { name: "Usage", exact: true }).click();
      await page
        .getByRole("region", { name: "Used by", exact: true })
        .getByRole("link", { name: "Welcome" })
        .click();
      await expect(
        page.getByRole("region", { name: "Selected instance" }),
      ).toContainText(title!);
      await expect(
        page.getByRole("region", { name: "Selected instance" }),
      ).toContainText(value!);
      await expect(page).toHaveURL(
        componentDesignUrl(`inspection/selection/${route}`, viewport),
      );
      if (route === "help")
        await expect(
          page
            .getByRole("region", { name: "Selected instance" })
            .getByText("No visible region", { exact: true }),
        ).toBeVisible();
    }
  });

  test(`a removed consumer keeps independent ${viewport} Changes membership`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    for (const route of ["states/removed", "states/removed-consumer"]) {
      await page.goto(componentDesignUrl(route, viewport));
      await expect(
        page.locator(
          viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count",
        ),
      ).toHaveText("2");
      if (viewport === "desktop") {
        await expect(page.locator(".mbk-nav-scroll a")).toContainText([
          "Farewell",
          "Action",
          "Compact · Removed",
        ]);
        await expect(
          page.locator(".mbk-nav-scroll .mbk-nav-changed"),
        ).toHaveCount(1);
      }
    }
  });
}
