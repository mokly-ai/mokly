import { expect, test } from "@playwright/test";

import { exportCatalogue } from "../../packages/mokly/dist/export/run.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import {
  appearance,
  control,
  desktopFrame,
  mobileFrame,
  screen,
  select,
  store,
} from "./appearance_assertions.js";
import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
import { expectFrameSource } from "./workspace_actions.js";

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
        catalogue === "mixed" ? screen : `${lightOnlySite.url}/view/home/`;
      const entry = catalogue === "mixed" ? "example/screens/welcome" : "home";
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
            new RegExp(`${entry}/index\\.${frameViewport}${dark}\\.html$`, "u"),
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
    /example\/screens\/welcome\/index\.mobile\.dark\.html$/,
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
    /example\/screens\/welcome\/index\.desktop\.dark\.html$/,
  );
});

test("a light-only catalogue hydrates a saved Dark appearance cleanly", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  await store(page, "dark");
  await installDevelopmentBundle(page, developmentBundle);
  await page.goto(`${lightOnlySite.url}/view/home/`);

  await expectCleanHydration(page, errors);
  await expect
    .poll(() => appearance(page))
    .toEqual({ scheme: "dark", theme: "dark", value: "dark" });
  await expectFrameSource(
    page.locator(mobileFrame),
    /home\/index\.mobile\.html$/,
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
