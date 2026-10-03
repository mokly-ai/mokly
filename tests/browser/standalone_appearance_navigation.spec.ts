import { expect, test } from "@playwright/test";

import {
  appearance,
  control,
  desktopFrame,
  mobileFrame,
  screen,
  select,
  startSuite,
  stopSuite,
  store,
} from "./standalone_appearance_fixture.js";
import { expectFrameSource } from "./workspace_actions.js";

test.beforeAll(startSuite);

test.afterAll(stopSuite);

test("a restored dark appearance swaps each frame at most once", async ({
  page,
}) => {
  await store(page, "dark");
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Only the frame documents; the shell's own view fetches are not swaps.
    if (
      /^\/static\/mokly-generated\/screens\/example-welcome\.(mobile|desktop)/u.test(
        url.pathname,
      )
    )
      requests.push(url.pathname);
  });
  await page.goto(screen);
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-welcome\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/example-welcome\.desktop\.dark\.html$/,
  );
  await page.waitForTimeout(500);

  for (const viewport of ["mobile", "desktop"]) {
    const dark = requests.filter((path) =>
      path.endsWith(`example-welcome.${viewport}.dark.html`),
    );
    expect(dark, `${viewport} settled on one dark fragment`).toHaveLength(1);
    const light = requests.filter((path) =>
      path.endsWith(`example-welcome.${viewport}.html`),
    );
    expect(
      light.length,
      `${viewport} swapped more than once`,
    ).toBeLessThanOrEqual(1);
  }
});

test("an appearance survives progressive navigation", async ({ page }) => {
  await page.goto(screen);
  await page.locator(select).selectOption("dark");
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  await page.evaluate(() => {
    (window as { __moklyDocument?: boolean }).__moklyDocument = true;
  });

  await page.click(
    'a[data-nav-row][data-route="screens/example-details.html"]',
  );
  await expect(page).toHaveURL(/screens\/example-details/u);
  expect(
    await page.evaluate(
      () => (window as { __moklyDocument?: boolean }).__moklyDocument === true,
    ),
    "the shell reloaded instead of navigating in place",
  ).toBe(true);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
});

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
    /screens\/example-welcome\.mobile\.dark\.html$/,
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
  await page.goto("/view/screens/missing.html");
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
      /screens\/example-welcome\.mobile\.html$/,
    );
  });
});

test("a component sample follows the one Appearance control", async ({
  page,
}) => {
  await page.goto("/view/components/example-action.html");
  const sample = page.locator('[data-workspace-frame="desktop"]');
  await expectFrameSource(
    sample,
    /components\/example-action-default\.desktop\.html$/,
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
    /components\/example-action-default\.desktop\.dark\.html$/,
  );

  await page.locator(select).selectOption("light");
  await expectFrameSource(
    sample,
    /components\/example-action-default\.desktop\.html$/,
  );
});
