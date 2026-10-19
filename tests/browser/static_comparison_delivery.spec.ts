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

for (const width of [390, 1280]) {
  test(`${width}px: copied comparisons read lazily and Refresh re-reads the same immutable generation`, async ({
    page,
    request,
    baseURL,
  }) => {
    const directory = copiedComparisonDirectory();
    const before = await files(directory);
    const { reviewUrl } = await deliveryIndex(request, baseURL!);
    const traffic = deliveryRequests(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${comparisonPaths.changed}/?viewport=desktop`);
    await expect(
      page.frameLocator('iframe[data-workspace-frame="desktop"]').locator("h1"),
    ).toHaveText("After screen");
    expect(traffic.urls.filter((url) => url.includes("/diffs/"))).toEqual([]);

    for (const mode of ["Side by side", "Overlay", "Difference"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await expect(
        page.frameLocator(".mb-pane--before iframe").locator("h1"),
      ).toHaveText("Before screen");
      await expect(
        page.frameLocator(".mb-pane--after iframe").locator("h1"),
      ).toHaveText("After screen");
      expect(traffic.urls.filter((url) => url === reviewUrl)).toHaveLength(1);
    }
    const response = page.waitForResponse((value) => value.url() === reviewUrl);
    await page.getByRole("button", { name: "Refresh comparison" }).click();
    expect((await response).ok()).toBe(true);
    await expect(
      page.frameLocator(".mb-pane--after iframe").locator("h1"),
    ).toHaveText("After screen");
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
