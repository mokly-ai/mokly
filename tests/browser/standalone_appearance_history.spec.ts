import { expect, test, type Page } from "@playwright/test";

import { expectFrameSource } from "./workspace_actions.js";

const welcome = "/view/screens/welcome.html";
const details = "/view/screens/details.html";
const select = "[data-mokly-appearance-select]";

async function navigate(page: Page, route: string): Promise<void> {
  const url = new URL(route, page.url());
  const row = page.locator(
    `a[data-nav-row][data-route="${url.pathname.slice(6)}"]`,
  );
  await row.evaluate((link, href) => link.setAttribute("href", href), route);
  await row.click();
  await expect(page).toHaveURL(url.href);
}

async function expectAppearance(
  page: Page,
  theme: "auto" | "light" | "dark",
  scheme = theme,
): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-theme", theme);
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    scheme,
  );
  await expect(page.locator(select)).toHaveValue(theme);
  const entry = page.url().includes("welcome") ? "welcome" : "details";
  const suffix = scheme === "dark" ? ".dark" : "";
  for (const viewport of ["mobile", "desktop"]) {
    const frame = page.locator(`[data-workspace-frame="${viewport}"]`);
    await expectFrameSource(
      frame,
      new RegExp(`${entry}\\.${viewport}${suffix}\\.html$`),
    );
  }
}

for (const choice of ["light", "auto"] as const) {
  test(`${choice} replaces a URL pin across navigation, Back and Forward`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`${welcome}?scheme=dark`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    await page.evaluate(() => {
      document.documentElement.dataset["historyProbe"] = "same";
    });
    await page.locator(select).selectOption(choice);
    await expectAppearance(page, choice, "light");

    await navigate(page, `${details}?scheme=dark`);
    await expectAppearance(page, choice, "light");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp("welcome.html\\?scheme=dark$"));
    await expectAppearance(page, choice, "light");
    await page.goForward();
    await expect(page).toHaveURL(new RegExp("details.html\\?scheme=dark$"));
    await expectAppearance(page, choice, "light");
    await expect(page.locator("html")).toHaveAttribute(
      "data-history-probe",
      "same",
    );
    if (choice === "auto") {
      const historyLength = await page.evaluate(() => history.length);
      await page.emulateMedia({ colorScheme: "dark" });
      await expectAppearance(page, "auto", "dark");
      expect(await page.evaluate(() => history.length)).toBe(historyLength);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp("welcome.html\\?scheme=dark$"));
      await expectAppearance(page, "auto", "dark");
    }
  });
}

test("in-shell pins update the whole appearance without saving a preference", async ({
  page,
}) => {
  await page.goto(`${welcome}?scheme=light`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await navigate(page, `${details}?scheme=dark`);
  await expectAppearance(page, "dark");
  await navigate(page, welcome);
  await expectAppearance(page, "dark");
  await page.goBack();
  await expect(page).toHaveURL(new RegExp("details.html\\?scheme=dark$"));
  await expectAppearance(page, "dark");
  await page.goBack();
  await expect(page).toHaveURL(new RegExp("welcome.html\\?scheme=light$"));
  await expectAppearance(page, "light");
  await page.goForward();
  await expect(page).toHaveURL(new RegExp("details.html\\?scheme=dark$"));
  await expectAppearance(page, "dark");
  expect(
    await page.evaluate(() => localStorage.getItem("mokly:theme")),
  ).toBeNull();
});
