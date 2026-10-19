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
  for (const [entryPath, text, metadata, document] of [
    [comparisonPaths.removedPage, "Historical page", "page", "index.html"],
    [
      comparisonPaths.removedScreen,
      "Historical screen",
      "screen",
      "index.desktop.html",
    ],
  ] as const) {
    test(`${width}px: copied ${metadata} history reads its metadata once and keeps its bytes`, async ({
      page,
      request,
      baseURL,
    }) => {
      const directory = copiedComparisonDirectory();
      const before = await files(directory);
      const { index, generation, reviewUrl } = await deliveryIndex(
        request,
        baseURL!,
      );
      const removed = index.removedEntries.find(
        (entry) => entry.entry.path === entryPath,
      )!;
      const traffic = deliveryRequests(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/view/${comparisonPaths.changed}/?viewport=desktop`);
      await expect(page.locator("#mb-main h2").first()).toHaveText(
        "Changed screen",
      );
      expect(traffic.urls.filter((url) => url.includes("/diffs/"))).toEqual([]);
      await page.goto(
        `/view/${entryPath}/?snapshot=${removed.snapshotId}&viewport=desktop`,
      );
      const frame = page.locator("iframe[data-mokly-preview-frame]");
      await expect(frame).toHaveCount(1);
      await expect(frame.contentFrame().locator("h1")).toHaveText(text);
      const documentUrl = `${generation}snapshots/before/mokly-generated/${entryPath}/${document}`;
      await expect(frame).toHaveAttribute(
        "data-mokly-preview-source",
        documentUrl,
      );
      const metadataUrl =
        metadata === "page"
          ? `${generation}previews/${entryPath}/index.json`
          : reviewUrl;
      expect(traffic.urls.filter((url) => url === metadataUrl)).toHaveLength(1);
      expect(
        traffic.urls.filter(
          (url) => url === `${generation}entries/${entryPath}.json`,
        ),
      ).toHaveLength(1);
      expect(traffic.urls.filter((url) => url === documentUrl)).toHaveLength(1);
      expect(
        traffic.urls.filter((url) => url.includes("/snapshots/after/")),
      ).toEqual([]);
      expect(
        traffic.urls.filter((url) =>
          url.includes(`/static/mokly-generated/${entryPath}/`),
        ),
      ).toEqual([]);
      for (const address of new Set(
        traffic.urls.filter((url) => url.includes("/diffs/generations/")),
      ))
        await copiedBytes(request, directory, address);
      expect(await files(directory)).toEqual(before);
      traffic.assert();
    });
  }
}
