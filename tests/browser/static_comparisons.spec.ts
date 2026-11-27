import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { staticRequests } from "./static_delivery_assertions.js";

test("a copied comparison reload keeps its non-null generation URL and loads the same snapshots", async ({
  page,
  request,
  baseURL,
}) => {
  const indexUrl = `${baseURL}/mokly-viewer/index.json`;
  const before = await (await request.get(indexUrl)).json();
  expect(before.comparisonUrl).not.toBeNull();
  const requests = staticRequests(page);
  await page.goto(
    `/view/${comparisonPaths.changed}/?viewport=desktop&comparison=side`,
  );
  await expect(
    page.locator(
      '[data-compare-mode="side"] iframe[data-mokly-comparison-frame]',
    ),
  ).toHaveCount(2);
  const source = await page
    .locator("iframe[data-mokly-comparison-frame]")
    .evaluateAll((frames) =>
      frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
    );
  await page.reload();
  await expect(
    page.locator(
      '[data-compare-mode="side"] iframe[data-mokly-comparison-frame]',
    ),
  ).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator("iframe[data-mokly-comparison-frame]")
        .evaluateAll((frames) =>
          frames.map((frame) =>
            frame.getAttribute("data-mokly-preview-source"),
          ),
        ),
    )
    .toEqual(source);
  const after = await (await request.get(indexUrl)).json();
  expect(after.comparisonUrl).toBe(before.comparisonUrl);
  expect(after.deploymentId).toBe(before.deploymentId);
  // Each load reads the same generation's pane documents once.
  for (const address of source)
    expect(requests.urls.filter((url) => url === address)).toHaveLength(2);
  requests.assert();
});
