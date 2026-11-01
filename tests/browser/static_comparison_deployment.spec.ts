import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { comparisonDeployments } from "./comparison_deployment_fixture.js";
import { comparisonPaths } from "./comparison_test.js";
import { staticRequests } from "./static_delivery_assertions.js";

let fixture: Awaited<ReturnType<typeof comparisonDeployments>>;
let changedGenerationFixture: Awaited<ReturnType<typeof comparisonDeployments>>;
test.beforeAll(async () => {
  fixture = await comparisonDeployments();
  changedGenerationFixture = await comparisonDeployments({
    changeGeneration: true,
  });
});

test("a new deployment reloads an old tab while its non-null comparison URL stays unchanged", async ({
  page,
}) => {
  const [before, after] = fixture.indexes;
  expect(before!.comparisonUrl).toMatch(/\/generations\/[a-f0-9]{64}\/$/);
  expect(after!.comparisonUrl).toBe(before!.comparisonUrl);
  expect(after!.deploymentId).not.toBe(before!.deploymentId);
  const requests = staticRequests(page);
  const stylesheetUrl = /\/mokly-viewer\/shell\.css(?:\?|$)/u;
  const deploymentComment = "/* Next viewer deployment */";
  const firstStylesheet = page.waitForResponse(stylesheetUrl);
  await page.goto(
    `${fixture.url}/view/${comparisonPaths.changed}/?viewport=desktop&comparison=side`,
  );
  await page.locator('[data-diff-mode="side"]').click();
  await expect(page.locator("iframe[data-mokly-comparison-frame]")).toHaveCount(
    2,
  );
  expect(await (await firstStylesheet).text()).not.toContain(deploymentComment);
  await page.locator("html").evaluate((html) => {
    html.setAttribute("data-test-old-tab", "true");
  });
  await fixture.replace();
  const secondStylesheet = page.waitForResponse(stylesheetUrl);
  await page.locator(`[data-entry-id="${comparisonPaths.unchanged}"]`).click();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-test-old-tab",
    "true",
  );
  expect(await (await secondStylesheet).text()).toContain(deploymentComment);
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
  await page.goto(
    `${fixture.url}/view/${comparisonPaths.changed}/?viewport=desktop&comparison=side`,
  );
  await expect(page.locator("iframe[data-mokly-comparison-frame]")).toHaveCount(
    2,
  );
  // Each tab reads the same generation's pane document once.
  const document = new URL(
    `snapshots/before/mokly-generated/${comparisonPaths.changed}/index.desktop.html`,
    new URL(before!.comparisonUrl!, fixture.url),
  ).href;
  expect(requests.urls.filter((url) => url === document)).toHaveLength(2);
  requests.assert();
});

test("a deployment check reloads before opening a changed comparison", async ({
  page,
}) => {
  const [before, after] = changedGenerationFixture.indexes;
  expect(before!.comparisonUrl).not.toBe(after!.comparisonUrl);
  await page.goto(
    `${changedGenerationFixture.url}/view/${comparisonPaths.changed}/?viewport=desktop`,
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await page.locator("html").evaluate((html) => {
    html.setAttribute("data-test-old-tab", "true");
  });
  await changedGenerationFixture.replace();
  const reloaded = page.waitForEvent("load");
  await page.locator('[data-diff-mode="side"]').click();
  await reloaded;
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-test-old-tab",
    "true",
  );
  await page.locator('[data-diff-mode="side"]').click();
  await expect(page.locator("iframe[data-mokly-comparison-frame]")).toHaveCount(
    2,
  );
});
