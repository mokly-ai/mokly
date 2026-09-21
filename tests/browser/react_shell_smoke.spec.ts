import { expect, test } from "@playwright/test";

test("the selected React shell hydrates its server-rendered document", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.location().url.includes("/static/")
    )
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/view/screens/welcome.html");
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
