import { expect } from "@playwright/test";

import { test } from "./browser_test.js";

test("the canvas section's path chip copies its path without navigating", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedPath?: string }).__copiedPath = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/view/example/screens/welcome/");
  const url = page.url();
  // The section on the canvas names the entry; Inspect's Path row is its
  // breadcrumbs, not a copy control.
  const pathChip = page.locator("[data-mokly-stage] [data-copy-path]");
  await expect(pathChip).toHaveText("example/screens/welcome");
  await pathChip.hover();
  expect(
    await pathChip.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");
  await page.mouse.down();
  const pressed = await pathChip.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, transform: style.transform };
  });
  expect(pressed.boxShadow).not.toBe("none");
  expect(pressed.transform).not.toBe("none");
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedPath?: string }).__copiedPath,
      ),
    )
    .toBe("example/screens/welcome");
  await expect(page).toHaveURL(url);
  await expect(page.locator("#mb-status")).toHaveText(
    "Copied path example/screens/welcome",
  );
});
