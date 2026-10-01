import { expect, test } from "@playwright/test";

import { readDisclosureStorage } from "./disclosure_storage.js";

test("stored obsolete collection keys do not close current folders", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "mokly:nav-disclosure:v2",
      JSON.stringify([
        "collection:Example",
        "collection:pages:Example",
        "collection:components:Example",
        "legacy:Example",
      ]),
    );
  });
  await page.goto("/view/user-flows/example-tour.html");
  const pages = page.locator('[data-nav-section="pages"]');
  await expect(
    pages.locator('[data-nav-folder="folder:Example"]'),
  ).toHaveAttribute("open", "");
  await expect(
    pages.locator('[data-nav-folder="folder:Example/Screens"]'),
  ).not.toHaveAttribute("open", "");
});

test("a mixed v2 list does not open normally closed folders on upgrade", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem(
      "mokly:nav-disclosure:v2",
      JSON.stringify([
        "collection:pages:Example/Screens",
        "section:pages",
        "variants:pages:example-welcome",
      ]),
    );
  });
  await page.goto("/view/user-flows/example-tour.html");
  await expect(
    page.locator('[data-nav-folder="folder:Example/Screens"]'),
  ).not.toHaveAttribute("open", "");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({
      "folder:pages:Example": true,
      "folder:pages:Example/Screens": false,
      "section:pages": true,
      "section:components": true,
    });
  expect(
    await page.evaluate(() => localStorage.getItem("mokly:nav-disclosure:v2")),
  ).toBeNull();
});

test("folder disclosures persist across reload without closing the same path in another section", async ({
  page,
}) => {
  await page.goto("/");
  const pagesFolder = page.locator(
    '[data-nav-section="pages"] [data-nav-folder="folder:Example"]',
  );
  const componentsFolder = page.locator(
    '[data-nav-section="components"] [data-nav-folder="folder:Example"]',
  );
  await expect(pagesFolder).toHaveAttribute("open", "");
  await expect(componentsFolder).toHaveAttribute("open", "");
  await pagesFolder.locator(":scope > summary").click();
  await expect(pagesFolder).not.toHaveAttribute("open", "");
  await expect
    .poll(() => readDisclosureStorage(page))
    .toMatchObject({ "folder:pages:Example": false });
  await page.reload();
  await expect(pagesFolder).not.toHaveAttribute("open", "");
  await expect(componentsFolder).toHaveAttribute("open", "");
});
