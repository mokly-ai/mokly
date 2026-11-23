import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Request } from "@playwright/test";

import { viewHref } from "@mokly/viewer/data";

import { mockupsOrigin as origin } from "../../../../apps/mockups/src/_tests_/origins";

import { catalogueIndex } from "./catalogue-index";

const screenshots = resolve(
  import.meta.dirname,
  "../../../../.context/mockups-smoke/served/product",
);

/** The renderer's wrapper, which carries a document's scheme and viewport. */
const wrapper = "[data-color-scheme][data-viewport]";

/** Each scheme, with the name that Browse's frames and Frames filter give it. */
const schemes = [
  ["light", "Light"],
  ["dark", "Dark"],
] as const;

/** A step's link to its screen, named `{step title}, {screen title} screen`. */
const screenLink = { name: /, .+ screen$/u };

/** The screen paths of one product flow's steps, in step order. */
function flowScreens(path: string): string[] {
  const flow = catalogueIndex().useCases.find((entry) => entry.path === path);
  if (!flow) throw new Error("Missing mockup flow " + path);
  return flow.steps.map((step) => step.screenPath);
}

function recordRequestFailure(errors: string[], request: Request) {
  if (request.failure()?.errorText !== "net::ERR_ABORTED")
    errors.push(request.url());
}

for (const journey of ["onboarding", "browse", "invitation"]) {
  const flow = "flows/product-" + journey;
  const screens = flowScreens(flow);

  test(
    "product flow " + journey + " renders canonical frames and backlinks",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) =>
        recordRequestFailure(errors, request),
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(origin + viewHref(flow));
      await expect(page.locator("iframe")).toHaveCount(screens.length);
      // Each step stands in step order in a frame that its label names by
      // its step, `Step {number} {title}`, with a link to its screen.
      const steps = page.getByRole("figure", { name: /^Step \d+ /u });
      const links = steps.getByRole("link", screenLink);
      await expect(links).toHaveCount(screens.length);
      mkdirSync(screenshots, { recursive: true });
      // A flow shows one scheme at a time, which its Frames filter chooses.
      for (const [scheme, name] of schemes) {
        await page
          .getByRole("group", { name: "Frames", exact: true })
          .getByRole("radio", { name, exact: true })
          .check();
        for (const [index, screen] of screens.entries()) {
          const step = steps.nth(index);
          const frame = step.locator("iframe").contentFrame();
          await expect(step).toHaveAccessibleName(
            new RegExp("^Step " + (index + 1) + " ", "u"),
          );
          await expect(links.nth(index)).toHaveAttribute(
            "href",
            viewHref(screen),
          );
          await expect(frame.locator(wrapper)).toHaveAttribute(
            "data-color-scheme",
            scheme,
          );
          await expect(frame.locator(wrapper)).toHaveAttribute(
            "data-viewport",
            "desktop",
          );
          await expect(
            frame.locator('[data-mkc-screen="' + screen + '"]'),
          ).toBeVisible();
        }
        await page.screenshot({
          path: resolve(screenshots, journey + ".desktop." + scheme + ".png"),
          fullPage: true,
          animations: "disabled",
        });
      }
      await links.first().click();
      await expect(page).toHaveURL(origin + viewHref(screens[0]));
      expect(errors).toEqual([]);
    },
  );

  test(
    "product flow " + journey + " visits every owning mobile screen",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) =>
        recordRequestFailure(errors, request),
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      const directory = resolve(screenshots, journey);
      mkdirSync(directory, { recursive: true });
      // Mobile journey evidence is captured from the served fragment in its
      // own 390px page, because a capture through Browse's canvas frame
      // scales it and clips content below the frame; the PNG bounds are
      // checked.
      const capture = await page.context().newPage();
      capture.on("pageerror", (error) => errors.push(error.message));
      capture.on("requestfailed", (request) =>
        recordRequestFailure(errors, request),
      );
      await capture.setViewportSize({ width: 390, height: 844 });
      for (const [index, screen] of screens.entries()) {
        await page.goto(origin + viewHref(screen));
        // The canvas shows the screen's Mobile frame in Light and in Dark at
        // once, each labelled by its viewport and scheme.
        for (const [scheme, name] of schemes) {
          const frame = page
            .getByRole("figure", { name: "Mobile · " + name })
            .locator("iframe")
            .contentFrame();
          await expect(frame.locator(wrapper)).toHaveAttribute(
            "data-color-scheme",
            scheme,
          );
          await expect(frame.locator(wrapper)).toHaveAttribute(
            "data-viewport",
            "mobile",
          );
          const artboard = frame.locator('[data-mkc-screen="' + screen + '"]');
          await expect(artboard).toBeVisible();
          const source = await frame
            .locator("html")
            .evaluate(() => location.href);
          expect(source).toBeTruthy();
          await capture.goto(new URL(source, origin).href);
          await expect(capture.locator(wrapper)).toHaveAttribute(
            "data-color-scheme",
            scheme,
          );
          await capture.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(
              [...document.images].map((image) => image.decode()),
            );
          });
          await expect(
            capture.locator('[data-mkc-screen="' + screen + '"]'),
          ).toBeVisible();
          const png = await capture.screenshot({
            path: resolve(directory, index + ".mobile." + scheme + ".png"),
            fullPage: true,
            animations: "disabled",
          });
          expect(png.readUInt32BE(16), "canonical mobile capture width").toBe(
            390,
          );
          const documentHeight = await capture.evaluate(
            () => document.documentElement.scrollHeight,
          );
          expect(
            Math.abs(png.readUInt32BE(20) - documentHeight),
            "full document height within browser pixel rounding",
          ).toBeLessThanOrEqual(2);
        }
      }
      await capture.close();
      expect(errors).toEqual([]);
    },
  );
}
