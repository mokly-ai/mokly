/**
 * The copied comparison stage in a wide and a narrow window, under the
 * comparison modes contract. In each viewport, scheme, and mode, every pane
 * frame uses the selected scheme, each version shows its own document, and
 * the page does not scroll sideways. Refresh comparison reads the pinned
 * generation again and presents the same versions.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton } from "./comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const FRAMES = "[data-diff-stage] iframe[data-mokly-comparison-frame]";
const VERSIONS = [
  ["Before", "Before screen"],
  ["Current", "After screen"],
] as const;

/** The document source of every pane frame, in order. */
function sources(page: Page): Promise<(string | null)[]> {
  return page
    .locator(FRAMES)
    .evaluateAll((frames) =>
      frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
    );
}

for (const width of [1280, 390])
  test(`every comparison mode fits a ${width}px window, and Refresh presents it again`, async ({
    page,
    request,
    baseURL,
  }) => {
    const index = await comparisonIndex(request, baseURL);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${comparisonPaths.changed}/`);
    const frames = page.locator(FRAMES);
    for (const viewport of ["mobile", "desktop", "both"] as const) {
      await chooseViewport(page, viewport);
      const shown = viewport === "both" ? ["mobile", "desktop"] : [viewport];
      for (const scheme of ["light", "dark"] as const) {
        await chooseScheme(page, scheme);
        for (const mode of ["Side by side", "Overlay", "Difference"] as const) {
          await modeButton(page, mode).click();
          await expect(frames).toHaveCount(shown.length * 2);
          for (const paneViewport of shown)
            for (const [title, heading] of VERSIONS) {
              const frame = page.locator(
                `${FRAMES}[title="${title} — ${paneViewport} — ${scheme}"]`,
              );
              await expect(frame).toHaveCSS("color-scheme", scheme);
              await expect(frame.contentFrame().locator("h1")).toHaveText(
                heading,
              );
            }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
      }
    }

    const loaded = await sources(page);
    const held: Route[] = [];
    await page.route(`**/${index.comparisonUrl}`, (route) => {
      held.push(route);
    });
    await page.getByRole("button", { name: "Refresh comparison" }).click();
    await expect.poll(() => held.length).toBe(1);
    const stage = page.locator("[data-diff-stage]");
    await expect(stage).toHaveAttribute("aria-busy", "true");
    await held[0]!.continue();
    await expect(stage).not.toHaveAttribute("aria-busy", "true");
    await expect(frames).toHaveCount(4);
    await expect.poll(() => sources(page)).toEqual(loaded);
    await modeButton(page, "Current").click();
    await expect(frames).toHaveCount(0);
  });
