import { expect, test } from "@playwright/test";

test("copying a multi-line shell block writes its lines without prompts", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs/start/your-first-screen/");
  const panel = page.locator(".site-code", {
    hasText: "npx mokly build --out mokly-static",
  });
  const copy = panel.getByRole("button");
  await expect(copy).toHaveText("Copy");
  await copy.click();
  await expect(copy).toHaveText("Copied");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("npx mokly serve\nnpx mokly build --out mokly-static");
});
