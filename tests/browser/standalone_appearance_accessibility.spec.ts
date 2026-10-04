import { expect, test } from "@playwright/test";

import {
  appearance,
  control,
  mobileFrame,
  screen,
  select,
} from "./appearance_assertions.js";
import { expectFrameSource } from "./workspace_actions.js";

test("the appearance keeps working when storage refuses", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new Error("blocked origin");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => ({ getItem: blocked, setItem: blocked, removeItem: blocked }),
    });
  });
  await page.goto(screen);
  await page.locator(select).selectOption("dark");
  // The choice holds for this document even though nothing could be saved.
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  await expectFrameSource(
    page.locator(mobileFrame),
    /example\/screens\/welcome\/index\.mobile\.dark\.html$/,
  );
});

test("Appearance can be set from the keyboard alone", async ({ page }) => {
  await page.goto(screen);
  await page.locator(select).focus();
  await expect(page.locator(select)).toBeFocused();
  await page.locator(select).press("ArrowDown");
  await page.locator(select).press("ArrowDown");
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
});

test("an unavailable route still offers Appearance", async ({ page }) => {
  await page.goto("/view/missing/");
  await expect(page.locator(control)).toBeVisible();
  await page.locator(select).selectOption("dark");
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-theme",
    "dark",
  );
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the control stays hidden and the system still dresses the shell", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(screen);
    // Nothing can act on the control, so the reader is never shown a dead one.
    await expect(page.locator(control)).toBeHidden();
    // Auto is CSS alone, so the interface is still dark.
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-theme",
      "auto",
    );
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(22, 21, 18)",
    );
    // The frames keep the sources the server rendered.
    await expectFrameSource(
      page.locator(mobileFrame),
      /example\/screens\/welcome\/index\.mobile\.html$/,
    );
  });
});

test("a component sample follows the one Appearance control", async ({
  page,
}) => {
  await page.goto("/view/example/components/action/");
  const sample = page.locator('[data-workspace-frame="desktop"]');
  await expectFrameSource(
    sample,
    /example\/components\/action\/default\/index\.desktop\.html$/,
  );
  // No separate preview control: the sample follows the interface appearance.
  await expect(page.getByRole("button", { name: "Dark preview" })).toHaveCount(
    0,
  );

  await page.locator(select).selectOption("dark");
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    sample,
    /example\/components\/action\/default\/index\.desktop\.dark\.html$/,
  );

  await page.locator(select).selectOption("light");
  await expectFrameSource(
    sample,
    /example\/components\/action\/default\/index\.desktop\.html$/,
  );
});
