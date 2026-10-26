import { expect } from "@playwright/test";

import { files } from "../helpers/directory_files.js";

import {
  copiedBytes,
  deliveryIndex,
  deliveryRequests,
} from "./comparison_delivery_assertions.js";
import {
  comparisonPaths,
  copiedComparisonDirectory,
  test,
} from "./comparison_test.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

for (const width of [390, 1280]) {
  test(`${width}px: copied comparisons read lazily and Refresh re-reads the same immutable generation`, async ({
    page,
    request,
    baseURL,
  }) => {
    const directory = copiedComparisonDirectory();
    const before = await files(directory);
    const { reviewUrl, generation } = await deliveryIndex(request, baseURL!);
    const traffic = deliveryRequests(page);
    const expectSelection = async (
      viewport: "mobile" | "desktop" | "both",
      scheme: "light" | "dark",
      mode: string,
      reads = 1,
    ) => {
      const views = viewport === "both" ? ["mobile", "desktop"] : [viewport];
      await expect(
        page.locator("iframe[data-mokly-comparison-frame]"),
      ).toHaveCount(views.length * 2);
      await expect(page.locator(`[data-diff-mode="${mode}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      for (const view of views) {
        const panes = page.locator(
          `[data-diff-viewport="${view}"] [data-compare-mode]`,
        );
        await expect(panes).toHaveAttribute("data-compare-mode", mode);
        const file = `index.${view}${scheme === "dark" ? ".dark" : ""}.html`;
        for (const [side, text] of [
          ["before", "Before screen"],
          ["after", "After screen"],
        ] as const) {
          const frame = panes.locator(`.mb-pane--${side} iframe`);
          await expect(frame).toHaveAttribute(
            "data-mokly-preview-source",
            `${generation}snapshots/${side}/mokly-generated/${comparisonPaths.changed}/${file}`,
          );
          await expect(frame.contentFrame().locator("h1")).toHaveText(text);
        }
      }
      expect(traffic.urls.filter((url) => url === reviewUrl)).toHaveLength(
        reads,
      );
    };
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${comparisonPaths.changed}/?viewport=desktop`);
    await expect(
      page.frameLocator('iframe[data-workspace-frame="desktop"]').locator("h1"),
    ).toHaveText("After screen");
    expect(traffic.urls.filter((url) => url.includes("/diffs/"))).toEqual([]);

    for (const [mode, label] of [
      ["side", "Side by side"],
      ["overlay", "Overlay"],
      ["difference", "Difference"],
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expectSelection("desktop", "light", mode);
    }
    for (const viewport of ["mobile", "both", "desktop"] as const) {
      await chooseViewport(page, viewport);
      await expectSelection(viewport, "light", "difference");
    }
    await chooseScheme(page, "dark");
    await expectSelection("desktop", "dark", "difference");
    await chooseViewport(page, "both");
    await expectSelection("both", "dark", "difference");
    const response = page.waitForResponse((value) =>
      value.url().startsWith(reviewUrl),
    );
    await page.getByRole("button", { name: "Refresh comparison" }).click();
    const refreshed = await response;
    expect(refreshed.url()).toBe(reviewUrl);
    expect(refreshed.ok()).toBe(true);
    await expectSelection("both", "dark", "difference", 2);
    expect(traffic.urls.filter((url) => url.includes("review.json"))).toEqual([
      reviewUrl,
      reviewUrl,
    ]);
    for (const address of new Set(
      traffic.urls.filter((url) => url.includes("/diffs/generations/")),
    ))
      await copiedBytes(request, directory, address);
    expect(await files(directory)).toEqual(before);
    traffic.assert();
  });
}
