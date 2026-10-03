import { expect, test } from "@playwright/test";

import { readDisclosureStorage } from "./disclosure_storage.js";

const earlierVersions = {
  "mokly:nav-disclosure:v3": JSON.stringify({
    "section:pages": false,
    "folder:pages:example": false,
    "folder:pages:example/screens": true,
  }),
  "mokly:nav-disclosure:v2": JSON.stringify([
    "collection:example",
    "collection:pages:example",
    "collection:components:example",
    "legacy:example",
  ]),
};

test("earlier storage versions naming current folders are never read", async ({
  page,
}) => {
  await page.addInitScript((values) => {
    if (window !== window.top) return;
    for (const [key, value] of Object.entries(values))
      localStorage.setItem(key, value);
  }, earlierVersions);
  await page.goto("/");
  const specs = page.locator('[data-nav-section="specs"]');
  await expect(specs).toHaveAttribute("open", "");
  await expect(
    specs.locator('[data-nav-folder="folder:example"]'),
  ).toHaveAttribute("open", "");
  await expect(
    specs.locator('[data-nav-folder="folder:example/screens"]'),
  ).not.toHaveAttribute("open", "");
});

test("saving v4 leaves earlier storage versions untouched", async ({
  page,
}) => {
  await page.addInitScript((values) => {
    if (window !== window.top) return;
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [key, value] of Object.entries(values))
      localStorage.setItem(key, value);
  }, earlierVersions);
  await page.goto("/view/example/tour/");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({
      "folder:specs:example": true,
      "folder:specs:example/screens": false,
      "section:specs": true,
      "section:components": true,
    });
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("mokly:nav-disclosure:"))
      .sort(),
  );
  expect(stored).toEqual([
    "mokly:nav-disclosure:v2",
    "mokly:nav-disclosure:v3",
    "mokly:nav-disclosure:v4",
  ]);
  for (const [key, value] of Object.entries(earlierVersions))
    expect(await page.evaluate((name) => localStorage.getItem(name), key)).toBe(
      value,
    );
});

test("a saved v4 section choice closes only that section", async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "mokly:nav-disclosure:v4",
      JSON.stringify({ "section:specs": false }),
    );
  });
  await page.goto("/");
  await expect(page.locator('[data-nav-section="specs"]')).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator('[data-nav-section="components"]')).toHaveAttribute(
    "open",
    "",
  );
});

test("folder disclosures persist across reload without closing the same path in another section", async ({
  page,
}) => {
  await page.goto("/");
  const specsFolder = page.locator(
    '[data-nav-section="specs"] [data-nav-folder="folder:example"]',
  );
  const componentsFolder = page.locator(
    '[data-nav-section="components"] [data-nav-folder="folder:example"]',
  );
  await expect(specsFolder).toHaveAttribute("open", "");
  await expect(componentsFolder).toHaveAttribute("open", "");
  await specsFolder.locator(":scope > summary").click();
  await expect(specsFolder).not.toHaveAttribute("open", "");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({
      "folder:specs:example": false,
      "folder:components:example": true,
    });
  await page.reload();
  await expect(specsFolder).not.toHaveAttribute("open", "");
  await expect(componentsFolder).toHaveAttribute("open", "");
});
