import { expect } from "@playwright/test";

import {
  appearance,
  expectCanvasFrames,
  screen,
  select,
  store,
} from "./appearance_assertions.js";
import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
import { expectFrameSource, viewportFrame } from "./workspace_actions.js";

let lightOnlySite: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  lightOnlySite = await serveCatalogue({
    "specs/home.screen.html": `---
title: Home
---
<style>:root { color-scheme: light; } @media (prefers-color-scheme: dark) { :root { color-scheme: dark; } }</style><h1>Home</h1><input aria-label="Date" type="date" />`,
  });
});
test.afterAll(async () => lightOnlySite?.close());

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
        // Each frame keeps its own scheme in both layouts. Below 900px the
        // compact layout shows the one frame of the preview scheme, such as
        // Mobile · Dark under Dark; a light-only catalogue has Light frames.
        await expectCanvasFrames(page, entry, catalogue === "mixed");
        if (viewport.width < 900) {
          const dark = scheme === "dark" && catalogue === "mixed";
          const shown = page.locator(viewportFrame("mobile"));
          await expect(shown).toHaveAttribute(
            "data-workspace-color-scheme",
            dark ? "dark" : "light",
          );
          await expectFrameSource(
            shown,
            new RegExp(
              `${entry}/index\\.mobile${dark ? "\\.dark" : ""}\\.html$`,
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
  await expectCanvasFrames(page, "example/screens/welcome", true);
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
  await expectCanvasFrames(page, "example/screens/welcome", true);
});

test("a light-only catalogue mounts with a saved Dark appearance", async ({
  page,
}) => {
  await store(page, "dark");
  await page.goto(`${lightOnlySite.url}/view/home/`);
  await expect
    .poll(() => appearance(page))
    .toEqual({ scheme: "dark", theme: "dark", value: "dark" });
  await expectCanvasFrames(page, "home", false);
});

for (const width of [390, 1280])
  test(`${width}: light-only previews keep their browser context under a Dark interface`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: null });
    await page.goto(`${lightOnlySite.url}/view/home/?scheme=dark`);
    for (const theme of ["dark", "light", "auto"] as const) {
      await page.locator(select).selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute(
        "data-mokly-theme",
        theme,
      );
      for (const viewport of ["mobile", "desktop"]) {
        const frame = page.locator(`[data-workspace-frame="${viewport}"]`);
        await expectFrameSource(
          frame,
          new RegExp(`home/index\\.${viewport}\\.html$`),
        );
        await expect(frame).toHaveCSS("color-scheme", "light");
        await expect(frame).toHaveCSS("background-color", "rgb(255, 255, 255)");
        await expect(frame.contentFrame().getByLabel("Date")).toHaveCSS(
          "color-scheme",
          "light",
        );
        expect(
          await frame.evaluate(
            (element: HTMLIFrameElement) =>
              element.contentWindow!.matchMedia("(prefers-color-scheme: dark)")
                .matches,
          ),
        ).toBe(false);
      }
      // The canvas and the compact layout below 900px draw no device chrome
      // whose colours could leave the light context.
      await expect(
        page.locator("#mb-main :is(.phone-screen, .browser-viewport)"),
      ).toHaveCount(0);
      await expect(page.locator(".mbk-frame-scheme-note")).toHaveCount(0);
    }
  });
