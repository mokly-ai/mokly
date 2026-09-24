import { expect, test } from "@playwright/test";

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
    .poll(() =>
      page.evaluate(() => localStorage.getItem("mokly:nav-disclosure:v2")),
    )
    .toContain("folder:pages:Example");
  await page.reload();
  await expect(pagesFolder).not.toHaveAttribute("open", "");
  await expect(componentsFolder).toHaveAttribute("open", "");
});
