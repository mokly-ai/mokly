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
import { expectFrameSource } from "./workspace_actions.js";

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
  test(`${catalogue}/desktop: Auto, Light, Dark and a pin form one appearance matrix`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1_280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    const target =
      catalogue === "mixed" ? screen : `${lightOnlySite.url}/view/home/`;
    const entry = catalogue === "mixed" ? "example/screens/welcome" : "home";
    // The context starts with empty storage, and each choice clears what it
    // saved, so each choice loads the shell once.
    for (const [choice, saved] of [
      ["auto", null],
      ["light", "light"],
      ["dark", "dark"],
      ["pin", null],
    ] as const) {
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
      // Each frame keeps its own scheme; a light-only catalogue has Light
      // frames.
      await expectCanvasFrames(page, entry, catalogue === "mixed");
      // A choice is the reader's saved preference; a pin dresses one
      // document and is not saved.
      expect(
        await page.evaluate(() => localStorage.getItem("mokly:theme")),
        choice,
      ).toBe(saved);
      await page.evaluate(() => localStorage.clear());
    }
  });
}

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

test("1280: light-only previews keep their browser context under a Dark interface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
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
    // The canvas of a catalogue without a dark axis names no Light-only
    // fallback.
    await expect(
      page.locator("[data-mokly-stage]").getByText("Light only"),
    ).toHaveCount(0);
  }
});
