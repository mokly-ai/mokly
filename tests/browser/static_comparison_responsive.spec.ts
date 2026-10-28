/**
 * The copied comparison stage in a wide and a narrow window, under the
 * comparison modes contract. Each case opens at 1,280 px and then sizes the
 * window. In each viewport, scheme, and mode, every pane frame uses the
 * selected scheme, each version shows its own document, and the page does
 * not scroll sideways. Refresh comparison reads the pinned generation again
 * and presents the same versions as new documents.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { markPaneDocuments } from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton } from "./comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

const FRAMES = "[data-diff-stage] iframe[data-mokly-comparison-frame]";
const VERSIONS = [
  ["Before", "Before screen"],
  ["Current", "After screen"],
] as const;

/** Open the changed screen at 1,280 px, then size the window. */
async function openAt(
  page: Page,
  width: number,
  viewport: "mobile" | "desktop" | "both",
): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await page.setViewportSize({ width, height: 900 });
  await chooseViewport(page, viewport);
}

/** The document source of every pane frame, in order. */
function sources(page: Page): Promise<(string | null)[]> {
  return page
    .locator(FRAMES)
    .evaluateAll((frames) =>
      frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
    );
}

for (const width of [1280, 390])
  for (const viewport of ["mobile", "desktop", "both"] as const)
    test(`${viewport}: every comparison mode fits a ${width}px window`, async ({
      page,
    }) => {
      await openAt(page, width, viewport);
      const frames = page.locator(FRAMES);
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
    });

test("Refresh comparison reads the pinned generation again and presents the same versions", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  await openAt(page, 390, "both");
  await modeButton(page, "Side by side").click();
  const frames = page.locator(FRAMES);
  await expect(frames).toHaveCount(4);
  for (const frame of await frames.all())
    await expect(frame.contentFrame().locator("h1")).toBeVisible();
  const loaded = await sources(page);
  const stage = page.locator("[data-diff-stage]");
  await markPaneDocuments(stage);

  // Hold every pane document that the refresh reads again.
  const held: Route[] = [];
  await page.route(`**/${index.comparisonUrl}snapshots/**/*.html`, (route) => {
    held.push(route);
  });
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect.poll(() => held.length).toBe(4);
  await expect(stage).toHaveAttribute("aria-busy", "true");
  for (const route of held) await route.continue();
  await expect(stage).not.toHaveAttribute("aria-busy", "true");
  await expect(frames).toHaveCount(4);
  await expect.poll(() => sources(page)).toEqual(loaded);
  // Refresh presents every document anew: no frame keeps a marked one.
  await expect
    .poll(() =>
      frames.evaluateAll((items) =>
        items.map((item) => {
          const document = (item as HTMLIFrameElement).contentDocument;
          return [document?.URL, document?.documentElement.dataset["probe"]];
        }),
      ),
    )
    .toEqual(Array.from({ length: 4 }, () => ["about:srcdoc", undefined]));
  for (const frame of await frames.all())
    await expect(frame.contentFrame().locator("h1")).toBeVisible();
  await modeButton(page, "Current").click();
  await expect(frames).toHaveCount(0);
});
