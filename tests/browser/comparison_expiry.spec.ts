import { mock } from "node:test";

import { expect, test, type Page } from "@playwright/test";

import type { RunningServer } from "../../dist/server/http_types.js";

import { loadComparison } from "./comparison_actions.js";
import { selectedComparisonFixture } from "./selected_comparison_fixture.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let server: RunningServer;
let now: number;
const cleanup: (() => Promise<void>)[] = [];
test.beforeAll(async () => {
  server = await selectedComparisonFixture({
    after: (dispose) => cleanup.push(dispose),
  });
});
test.beforeEach(() => {
  now = Date.now();
  mock.method(Date, "now", () => now);
});
test.afterEach(() => mock.restoreAll());
test.afterAll(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
});

async function expireSnapshots(page: Page, snapshot: string): Promise<void> {
  now += 120_001;
  const pruning = await page.request.get(
    `${server.url}/__mokly/diffs/review.json?route=components%2Faction.html&variant=default`,
  );
  expect(pruning.ok()).toBe(true);
  expect((await page.request.get(snapshot)).status()).toBe(404);
}

for (const change of ["theme", "viewport"] as const)
  test(`an idle Difference recovers expired snapshots before changing ${change}`, async ({
    page,
  }) => {
    const requests: URL[] = [];
    const failedPanes: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/__mokly/diffs/review.json") requests.push(url);
    });
    page.on("response", (response) => {
      if (response.url().includes("/snapshots/") && !response.ok())
        failedPanes.push(response.url());
    });
    await page.goto(`${server.url}/view/screens/home.html`);
    await chooseViewport(page, "desktop");
    await chooseScheme(page, "light");
    await loadComparison(page, "Overlay");
    await page.getByRole("button", { name: "Difference", exact: true }).click();
    await expect(
      page.frameLocator(".mb-pane--before iframe").locator("main"),
    ).toContainText("Screen content");
    await expect(
      page.frameLocator(".mb-pane--after iframe").locator("main"),
    ).toContainText("Updated screen");
    await expect(page.locator("[data-diff-stage]")).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    const snapshot = await page
      .locator(".mb-pane--after iframe")
      .getAttribute("src");
    expect(snapshot).not.toBeNull();
    await expireSnapshots(page, snapshot!);

    if (change === "theme") await chooseScheme(page, "dark");
    else await chooseViewport(page, "mobile");

    await expect(
      page.frameLocator(".mb-pane--before iframe").locator("main"),
    ).toContainText("Screen content");
    await expect(
      page.frameLocator(".mb-pane--after iframe").locator("main"),
    ).toContainText("Updated screen");
    await expect(page.locator(".mb-pane--after iframe")).toHaveAttribute(
      "src",
      change === "theme" ? /\.desktop\.dark\.html$/ : /\.mobile\.html$/,
    );
    await expect(page.locator(".mb-panes")).toHaveAttribute(
      "data-compare-mode",
      "difference",
    );
    expect(requests).toHaveLength(2);
    expect(requests[1]!.searchParams.get("route")).toBe("screens/home.html");
    expect(requests[1]!.searchParams.has("refresh")).toBe(false);
    expect(failedPanes).toEqual([]);
  });

test("snapshot recovery keeps the selected saved variant", async ({ page }) => {
  const requests: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/__mokly/diffs/review.json") requests.push(url);
  });
  await page.goto(`${server.url}/view/components/action.html?variant=disabled`);
  await chooseViewport(page, "desktop");
  await loadComparison(page, "Side by side");
  await expect(
    page
      .frameLocator(".mb-pane--after iframe")
      .getByRole("button", { name: "Proceed", exact: true }),
  ).toBeDisabled();
  const snapshot = await page
    .locator(".mb-pane--after iframe")
    .getAttribute("src");
  expect(snapshot).not.toBeNull();
  await expireSnapshots(page, snapshot!);
  await chooseViewport(page, "mobile");
  await expect(
    page
      .frameLocator(".mb-pane--before iframe")
      .getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .frameLocator(".mb-pane--after iframe")
      .getByRole("button", { name: "Proceed", exact: true }),
  ).toBeDisabled();
  expect(requests).toHaveLength(2);
  expect(requests[1]!.searchParams.get("route")).toBe("components/action.html");
  expect(requests[1]!.searchParams.get("variant")).toBe("disabled");
});
