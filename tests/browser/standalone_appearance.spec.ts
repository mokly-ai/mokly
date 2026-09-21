import { expect, test, type Page } from "@playwright/test";

import { expectFrameSource } from "./workspace_actions.js";

const control = ".mbk-topbar [data-mokly-appearance-control]";
const select = "[data-mokly-appearance-select]";
const mobileFrame = ".mbk-frame-mobile iframe";
const desktopFrame = ".mbk-frame-desktop iframe";
const screen = "/view/screens/welcome.html";

/** The appearance the document actually settled on, root mark and all. */
async function appearance(page: Page): Promise<{
  scheme: string | null;
  theme: string | null;
  value: string;
}> {
  return await page.evaluate(() => ({
    scheme: document.body.getAttribute("data-mokly-color-scheme"),
    theme: document.documentElement.getAttribute("data-mokly-theme"),
    value:
      document.querySelector<HTMLSelectElement>(
        "[data-mokly-appearance-select]",
      )?.value ?? "",
  }));
}

async function store(page: Page, value: string): Promise<void> {
  await page.addInitScript((theme) => {
    localStorage.setItem("mokly:theme", theme as string);
  }, value);
}

test("a scheme pin paints the document without being saved", async ({
  page,
}) => {
  await page.goto(`${screen}?scheme=dark`);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.dark\.html$/,
  );
  // A pin dresses one document; it is not the reader's saved preference.
  expect(
    await page.evaluate(() => localStorage.getItem("mokly:theme")),
  ).toBeNull();
});

test("a saved appearance is restored on a later visit", async ({ page }) => {
  await page.goto(screen);
  await page.locator(select).selectOption("dark");
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });

  await page.goto(screen);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/welcome\.desktop\.dark\.html$/,
  );
});

test("a saved appearance outranks the system and the pin outranks it", async ({
  page,
}) => {
  await store(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(screen);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "light",
      theme: "light",
      value: "light",
    });

  await page.goto(`${screen}?scheme=dark`);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  // The pin dressed this document; the saved preference is still the reader's.
  expect(await page.evaluate(() => localStorage.getItem("mokly:theme"))).toBe(
    "light",
  );
});

test("Auto follows the system while the document stays open", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(screen);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "light",
      theme: "auto",
      value: "auto",
    });

  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "auto",
      value: "auto",
    });
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.dark\.html$/,
  );

  // An explicit choice is the reader's, so the system no longer moves it.
  await page.locator(select).selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "light",
      theme: "light",
      value: "light",
    });
});

test("a restored dark appearance swaps each frame at most once", async ({
  page,
}) => {
  await store(page, "dark");
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Only the frame documents; the shell's own view fetches are not swaps.
    if (/^\/static\/screens\/welcome\.(mobile|desktop)/u.test(url.pathname))
      requests.push(url.pathname);
  });
  await page.goto(screen);
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/welcome\.desktop\.dark\.html$/,
  );
  await page.waitForTimeout(500);

  for (const viewport of ["mobile", "desktop"]) {
    const dark = requests.filter((path) =>
      path.endsWith(`welcome.${viewport}.dark.html`),
    );
    expect(dark, `${viewport} settled on one dark fragment`).toHaveLength(1);
    const light = requests.filter((path) =>
      path.endsWith(`welcome.${viewport}.html`),
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

  await page.click('a[data-nav-row][data-route="screens/details.html"]');
  await expect(page).toHaveURL(/screens\/details/u);
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
    /screens\/welcome\.mobile\.dark\.html$/,
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
      "rgb(20, 24, 22)",
    );
    // The frames keep the sources the server rendered.
    await expectFrameSource(
      page.locator(mobileFrame),
      /screens\/welcome\.mobile\.html$/,
    );
  });
});

test("a component sample follows the one Appearance control", async ({
  page,
}) => {
  await page.goto("/view/components/action.html");
  const sample = page.frameLocator('[data-workspace-frame="desktop"]');
  await expect(sample.locator("body")).toBeVisible();
  // No separate preview control: the sample follows the interface appearance.
  await expect(page.getByRole("button", { name: "Dark preview" })).toHaveCount(
    0,
  );

  await page.locator(select).selectOption("dark");
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(sample.locator("[data-scheme]").first()).toHaveAttribute(
    "data-scheme",
    "dark",
  );

  await page.locator(select).selectOption("light");
  await expect(sample.locator("[data-scheme]").first()).toHaveAttribute(
    "data-scheme",
    "light",
  );
});
