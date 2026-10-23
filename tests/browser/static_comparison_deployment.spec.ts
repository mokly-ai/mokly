import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { comparisonDeployments } from "./comparison_deployment_fixture.js";
import { comparisonPaths } from "./comparison_test.js";
import { staticRequests } from "./static_delivery_assertions.js";

let fixture: Awaited<ReturnType<typeof comparisonDeployments>>;
test.beforeAll(async () => {
  fixture = await comparisonDeployments();
});

test("a new deployment reloads an old tab while its non-null comparison URL stays unchanged", async ({
  page,
}) => {
  const [before, after] = fixture.indexes;
  expect(before!.comparisonUrl).toMatch(
    /\/generations\/[a-f0-9]{64}\/review\.json$/,
  );
  expect(after!.comparisonUrl).toBe(before!.comparisonUrl);
  expect(after!.deploymentId).not.toBe(before!.deploymentId);
  const requests = staticRequests(page);
  const stylesheetUrl = /\/mokly-viewer\/shell\.css(?:\?|$)/u;
  const deploymentComment = "/* Next viewer deployment */";
  const firstStylesheet = page.waitForResponse(stylesheetUrl);
  await page.goto(
    `${fixture.url}/view/${comparisonPaths.changed}/?viewport=desktop&comparison=side`,
  );
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
  expect(
    requests.urls.filter(
      (url) => url === new URL(before!.comparisonUrl!, fixture.url).href,
    ),
  ).toHaveLength(2);
  requests.assert();
});
