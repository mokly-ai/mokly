import { expect, test } from "@playwright/test";

import { createPreviewComparisonFixture } from "../helpers/preview_comparison_fixture.js";

import { servePreviewFixture, type PreviewFixture } from "./preview_fixture.js";

let fixture: Awaited<ReturnType<typeof createPreviewComparisonFixture>>;
let preview: PreviewFixture;

test.beforeAll(async () => {
  fixture = await createPreviewComparisonFixture();
  preview = await servePreviewFixture(fixture.output);
});
test.afterAll(async () => {
  await preview?.close();
  await fixture?.close();
});

for (const width of [390, 1280]) {
  test(`removed published pages keep baseline context only in Changes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${preview.url}/id/removed-document`);
    await expect(page.locator(".mbk-screen-head h2")).toHaveText(
      "Former handbook",
    );
    await expect(page.locator(".mbk-crumbs")).toHaveText("Documents");
    await expect(page.locator(".mbk-crumbs a")).toHaveCount(0);
    await expect(page.locator("#mb-main")).toContainText(
      "Showing previous version",
    );
    await expect(
      page.frameLocator("[data-mokly-preview] iframe").locator("body"),
    ).toContainText("Previous document");
    await expect(
      page.locator("[data-mokly-preview] [data-mokly-preview-retry]"),
    ).toHaveCount(0);
    await expect(
      page.locator("[data-diff-screen], [data-viewport-option]"),
    ).toHaveCount(0);
    await page.locator("[data-mokly-details] summary").click();
    await expect(page.locator("[data-mokly-details]")).toContainText(
      "Documents",
    );
    if (width < 700)
      await page
        .getByRole("button", { name: "Open catalogue navigation" })
        .click();
    const removed = page.locator('[data-entry-id="removed-document"]');
    await expect(removed).toBeHidden();
    await page.locator('[data-filter="changed"]').click();
    await expect(removed).toBeVisible();
    await expect(
      page.locator('[data-nav-collection="collection:Documents"]'),
    ).toHaveCount(0);
    expect(
      await removed.evaluate(
        (element) => element.closest("details[data-nav-collection]") === null,
      ),
    ).toBe(true);
    await page.locator('[data-filter="all"]').click();
    await expect(removed).toBeHidden();
    await expect(page.locator('[data-entry-id="removed"]')).toBeVisible();
    await page.goto(`${preview.url}/id/handbook?fragment=overview`);
    await expect(
      page.frameLocator(".mbk-stage-embed iframe").locator("#overview"),
    ).toBeVisible();
    await expect(
      page.locator("[data-diff-screen], [data-viewport-option]"),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.frameLocator(".mbk-stage-embed iframe").locator("#overview"),
    ).toBeVisible();
    expect(requests.filter((url) => /\/__mokly\/events\//.test(url))).toEqual(
      [],
    );
    expect(
      requests.filter((url) => /\/__mokly\/diffs\/review\.json/.test(url)),
    ).toEqual([]);
    expect(
      requests.filter((url) =>
        /\/pages\/removed-document\.html\.json$/.test(url),
      ),
    ).toHaveLength(1);
  });
}
