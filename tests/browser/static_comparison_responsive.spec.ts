/**
 * The copied comparison on the canvas in a wide and a narrow window, under
 * the comparison panes contract. Each case opens at 1,280 px and then sizes
 * the window. The wide window shows each viewport choice. The narrow window
 * shows both viewports, and its compact layout compares its one shown frame.
 * In each case, scheme, and mode, every pane frame of the compared frames
 * uses its frame's scheme, each version shows its own document, and the page
 * does not scroll sideways. Refresh comparison reads the pinned generation
 * again and presents the same versions as new documents.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { markPaneDocuments } from "./comparison_scroll.js";
import { comparisonSection, paneFrame } from "./comparison_sections.js";
import { comparedViewports } from "./comparison_static_frames.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseMode,
  compareStage,
  COMPARE_MODES,
  comparisonFrames,
  comparisonIndex,
  modeButton,
} from "./comparison_ui.js";
import { inspectTitle } from "./inspect_head.js";
import { chooseViewport, setFrames } from "./workspace_actions.js";

const VERSIONS = [
  ["before", "Before", "Before screen"],
  ["after", "Current", "After screen"],
] as const;

/** Open the changed screen at 1,280 px, then size the window. */
async function openAt(
  page: Page,
  width: number,
  viewport: "mobile" | "desktop" | "both",
): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await expect(inspectTitle(page)).toHaveText("Changed screen");
  await page.setViewportSize({ width, height: 900 });
  await chooseViewport(page, viewport);
}

/** The document source of every pane frame, in order. */
function sources(page: Page): Promise<(string | null)[]> {
  return comparisonFrames(page).evaluateAll((frames) =>
    frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
  );
}

/**
 * Each window width and the viewport choice that it compares: every choice
 * in the wide window, and both viewports in the narrow one.
 */
const FIT_CASES = [
  [1280, "mobile"],
  [1280, "desktop"],
  [1280, "both"],
  [390, "both"],
] as const;

for (const [width, viewport] of FIT_CASES)
  test(`${viewport}: every comparison mode fits a ${width}px window`, async ({
    page,
  }) => {
    await openAt(page, width, viewport);
    for (const scheme of ["light", "dark"] as const) {
      // The Frames filter shows the frames of one scheme.
      await setFrames(page, {
        light: scheme === "light",
        dark: scheme === "dark",
      });
      for (const label of ["Side by side", "Overlay", "Difference"] as const) {
        await chooseMode(page, label);
        const compared = comparedViewports(
          width,
          viewport,
          COMPARE_MODES[label],
        );
        await expect(comparisonFrames(page)).toHaveCount(compared.length * 2);
        for (const paneViewport of compared)
          for (const [side, title, heading] of VERSIONS) {
            const frame = paneFrame(
              comparisonSection(page, paneViewport, scheme),
              side,
            );
            await expect(frame).toHaveAttribute(
              "title",
              `${title} — ${paneViewport} — ${scheme}`,
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
  // The compact layout compares its one frame, Mobile · Light.
  await chooseMode(page, "Side by side");
  const frames = comparisonFrames(page);
  await expect(frames).toHaveCount(2);
  for (const frame of await frames.all())
    await expect(frame.contentFrame().locator("h1")).toBeVisible();
  const loaded = await sources(page);
  const stage = compareStage(page);
  await markPaneDocuments(stage);

  // Hold every pane document that the refresh reads again.
  const held: Route[] = [];
  await page.route(`**/${index.comparisonUrl}snapshots/**/*.html`, (route) => {
    held.push(route);
  });
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect.poll(() => held.length).toBe(2);
  await expect(stage).toHaveAttribute("aria-busy", "true");
  for (const route of held) await route.continue();
  await expect(stage).not.toHaveAttribute("aria-busy", "true");
  await expect(frames).toHaveCount(2);
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
    .toEqual(Array.from({ length: 2 }, () => ["about:srcdoc", undefined]));
  for (const frame of await frames.all())
    await expect(frame.contentFrame().locator("h1")).toBeVisible();
  await modeButton(page, "Current").click();
  await expect(frames).toHaveCount(0);
});
