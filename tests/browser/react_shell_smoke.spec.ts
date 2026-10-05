import { expect, test } from "@playwright/test";

import { captureBrowserErrors } from "./console_notices.js";

test("the selected React shell hydrates its server-rendered document", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);

  const response = await page.goto("/view/example/screens/welcome/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-react-shell",
    "",
  );
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await expect(page.locator("[data-mokly-shell]")).toBeVisible();
  await expect(page.locator("main")).toContainText("Welcome");
  expect(errors).toEqual([]);
});
