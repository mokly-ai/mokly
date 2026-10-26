import { expect } from "@playwright/test";

import { files } from "../helpers/static_faults.js";

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
    const { generation } = await deliveryIndex(request, baseURL!);
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
          const document = `${generation}snapshots/${side}/mokly-generated/${comparisonPaths.changed}/${file}`;
          await expect(frame).toHaveAttribute(
            "data-mokly-preview-source",
            document,
          );
          await expect(frame.contentFrame().locator("h1")).toHaveText(text);
          await expect
            .poll(() => traffic.urls.filter((url) => url === document).length)
            .toBe(reads);
        }
      }
      // A pinned generation's root is never requested; panes read snapshots.
      expect(
        traffic.urls.filter(
          (url) =>
            url.startsWith(generation) &&
            !url.startsWith(`${generation}snapshots/`),
        ),
      ).toEqual([]);
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
    // Refresh presents the same immutable generation again, so each shown
    // document is read a second time.
    await page.getByRole("button", { name: "Refresh comparison" }).click();
    await expectSelection("both", "dark", "difference", 2);
    for (const address of new Set(
      traffic.urls.filter((url) => url.includes("/diffs/generations/")),
    ))
      await copiedBytes(request, directory, address);
    expect(await files(directory)).toEqual(before);
    traffic.assert();
  });
}
