import { expect, test } from "@playwright/test";

import {
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
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
  suiteState,
} from "./standalone_appearance_fixture.js";
import { expectFrameSource } from "./workspace_actions.js";

test.beforeAll(startSuite);

test.afterAll(stopSuite);

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
          : `${suiteState.lightOnlySite.url}/view/screens/home.html`;
      const entry = catalogue === "mixed" ? "example-welcome" : "home";
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
    /screens\/example-welcome\.mobile\.dark\.html$/,
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
    /screens\/example-welcome\.desktop\.dark\.html$/,
  );
});

test("a light-only catalogue hydrates a saved Dark appearance cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await store(page, "dark");
  await installDevelopmentBundle(page, suiteState.developmentBundle);
  await page.goto(`${suiteState.lightOnlySite.url}/view/screens/home.html`);

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
  await installDevelopmentBundle(page, suiteState.developmentBundle);
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
    /screens\/example-welcome\.mobile\.dark\.html$/,
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
    /screens\/example-welcome\.mobile\.dark\.html$/,
  );
});
