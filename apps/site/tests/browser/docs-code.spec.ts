import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

const PAGE = "/docs/start/your-first-screen/";

/** A `#rrggbb` token colour as the browser computes it. */
function rgb(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return `rgb(${red}, ${green}, ${blue})`;
}

test("copying a multi-line shell block writes its lines without prompts", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(PAGE);
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

test("a code panel stays dark in both schemes", async ({ page }, testInfo) => {
  await page.goto(PAGE);
  const panel = page.locator(".site-code", {
    hasText: "npx mokly build --out mokly-static",
  });
  const fill =
    testInfo.project.use.colorScheme === "dark"
      ? tokens.color.dark.surfaceMuted
      : tokens.color.light.text;
  await expect(panel).toHaveCSS("background-color", rgb(fill));
});

test("Copy sits beside the sample's language at the end of its tab bar", async ({
  page,
}) => {
  await page.goto(PAGE);
  const panel = page.locator(".site-code", { hasText: "welcome.screen.html" });
  const language = panel.getByText("html", { exact: true });
  const copy = panel.getByRole("button");
  await expect(copy).toHaveText("Copy");
  // The bar's 4px gap is the only space between the language and Copy.
  await expect
    .poll(async () => {
      const [before, after] = await Promise.all([
        language.boundingBox(),
        copy.boundingBox(),
      ]);
      return before && after
        ? Math.round(after.x - (before.x + before.width))
        : undefined;
    })
    .toBe(4);
});
