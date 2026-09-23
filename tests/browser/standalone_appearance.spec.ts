import { expect, test, type Page } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
import { expectFrameSource } from "./workspace_actions.js";

const control = ".mbk-topbar [data-mokly-appearance-control]";
const select = "[data-mokly-appearance-select]";
const mobileFrame = ".mbk-frame-mobile iframe";
const desktopFrame = ".mbk-frame-desktop iframe";
const screen = "/view/screens/welcome.html";

let lightOnlyFixture: Awaited<ReturnType<typeof createExportFixture>>;
let lightOnlySite: Awaited<ReturnType<typeof serveStaticFiles>>;
let developmentBundle: string;
test.beforeAll(async () => {
  developmentBundle = await buildDevelopmentBundle();
  lightOnlyFixture = await createExportFixture();
  await exportCatalogue(lightOnlyFixture.config, { outDir: "site" });
  lightOnlySite = await serveStaticFiles(lightOnlyFixture.output);
});
test.afterAll(async () => {
  await lightOnlySite.close();
  await lightOnlyFixture.close();
});

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

for (const catalogue of ["mixed", "light-only"] as const) {
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1_280, height: 900 },
  ] as const) {
    test(`${catalogue}/${viewport.name}: Auto, Light, Dark and a pin form one appearance matrix`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: "dark" });
      const target =
        catalogue === "mixed"
          ? screen
          : `${lightOnlySite.url}/view/screens/home.html`;
      const entry = catalogue === "mixed" ? "welcome" : "home";
      for (const choice of ["auto", "light", "dark", "pin"] as const) {
        await page.goto(target);
        await page.evaluate(() => localStorage.clear());
        await page.goto(choice === "pin" ? `${target}?scheme=dark` : target);
        if (choice !== "auto" && choice !== "pin")
          await page.locator(select).selectOption(choice);
        const theme = choice === "pin" ? "dark" : choice;
        const scheme = choice === "auto" ? "dark" : theme;
        await expect
          .poll(() => appearance(page))
          .toEqual({
            scheme,
            theme,
            value: theme,
          });
        for (const [frame, frameViewport] of [
          [mobileFrame, "mobile"],
          [desktopFrame, "desktop"],
        ] as const) {
          const dark =
            scheme === "dark" && catalogue === "mixed" ? ".dark" : "";
          await expectFrameSource(
            page.locator(frame),
            new RegExp(
              `screens/${entry}\\.${frameViewport}${dark}\\.html$`,
              "u",
            ),
          );
        }
      }
    });
  }
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

test("a light-only catalogue hydrates a saved Dark appearance cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await store(page, "dark");
  await installDevelopmentBundle(page, developmentBundle);
  await page.goto(`${lightOnlySite.url}/view/screens/home.html`);

  await expectCleanHydration(page, errors);
  await expect
    .poll(() => appearance(page))
    .toEqual({ scheme: "dark", theme: "dark", value: "dark" });
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/home\.mobile\.html$/,
  );
});

test("a missing appearance startup asset leaves its control hidden", async ({
  page,
}) => {
  await page.route("**/__mokly/client/appearance-startup.js", (route) =>
    route.abort(),
  );
  await installDevelopmentBundle(page, developmentBundle);
  await page.goto(screen);

  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await expect(page.locator(control)).toBeHidden();
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

test("Auto keeps following the system after a back-forward cache restore", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(screen);
  await expect
    .poll(() => appearance(page))
    .toEqual({ scheme: "light", theme: "auto", value: "auto" });

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await page.emulateMedia({ colorScheme: "dark" });

  await expect
    .poll(() => appearance(page))
    .toEqual({ scheme: "dark", theme: "auto", value: "auto" });
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/welcome\.mobile\.dark\.html$/,
  );
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
      "rgb(22, 21, 18)",
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
  const sample = page.locator('[data-workspace-frame="desktop"]');
  await expectFrameSource(sample, /action\.variants\/default\.desktop\.html$/);
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
    /action\.variants\/default\.desktop\.dark\.html$/,
  );

  await page.locator(select).selectOption("light");
  await expectFrameSource(sample, /action\.variants\/default\.desktop\.html$/);
});
