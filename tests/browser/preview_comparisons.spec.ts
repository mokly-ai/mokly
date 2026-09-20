import { expect, test } from "@playwright/test";

import { createPreviewComparisonFixture } from "../helpers/preview_comparison_fixture.js";

import { servePreviewFixture, type PreviewFixture } from "./preview_fixture.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof createPreviewComparisonFixture>>;
let preview: PreviewFixture;

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(90_000);
  fixture = await createPreviewComparisonFixture();
  preview = await servePreviewFixture(fixture.output);
});
test.afterAll(async () => {
  await preview?.close();
  await fixture?.close();
});

test("published Mokly exposes lazy comparisons in the actual shell", async ({
  page,
}) => {
  const requests: string[] = [];
  const failed: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto(`${preview.url}/view/screens/home`);
  const modes = page.getByRole("group", { name: "Comparison mode" });
  await expect(modes).toBeVisible();
  await expect(
    modes.getByRole("button", { name: "Current", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-filter="changed"]').click();
  await chooseViewport(page, "desktop");
  expect(requests.filter((url) => url.includes("/__mokly/diffs/"))).toEqual([]);

  await modes.getByRole("button", { name: "Overlay", exact: true }).click();
  const frames = page.locator("[data-diff-stage] iframe");
  await expect(frames).toHaveCount(2);
  await expect(page.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "overlay",
  );
  await expect(
    page.frameLocator("[data-diff-stage] iframe").first().locator("body"),
  ).not.toBeEmpty();
  for (const frame of await frames.all()) {
    await expect(frame).toHaveAttribute("sandbox", "");
    await expect(frame).toHaveAttribute("src", /\/diffs\/__generations\//);
  }
  for (const [label, mode] of [
    ["Side by side", "side"],
    ["Difference", "difference"],
  ] as const) {
    await modes.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".mb-panes")).toHaveAttribute(
      "data-compare-mode",
      mode,
    );
  }
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect(frames).toHaveCount(2);
  await modes.getByRole("button", { name: "Current", exact: true }).click();
  await expect(frames).toHaveCount(0);
  await expect(page.locator("[data-current-screen]")).toBeVisible();
  expect(requests.some((url) => url.includes("/__mokly/events"))).toBe(false);
  expect(failed).toEqual([]);
});

test("published comparisons retain mobile, dark, and current-only added and removed screens", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(`${preview.url}/id/removed`);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await chooseViewport(page, "mobile");
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(
    page
      .frameLocator("[data-mokly-preview] .mbk-frame-mobile iframe")
      .locator("main"),
  ).toHaveText("removed");
  await expect(page.locator("[data-diff-stage]")).toHaveCount(0);
  await page.getByRole("button", { name: "Open catalogue navigation" }).click();
  await page.locator('[data-filter="changed"]').click();
  await expect(
    page.locator('[data-route="screens/removed.html"]'),
  ).toBeVisible();
  await page.locator('[data-route="screens/added.html"]').click();
  await expect(page.locator("[data-workspace-status]")).toHaveText("Added");
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page.frameLocator('[data-workspace-frame="mobile"]').locator("main"),
  ).toHaveText("added");
  await page.goto(`${preview.url}/view/screens/home`);
  await chooseViewport(page, "mobile");
  await chooseScheme(page, "dark");
  await page.getByRole("button", { name: "Difference", exact: true }).click();
  const frames = page.locator("[data-diff-stage] iframe");
  await expect(frames).toHaveCount(2);
  await expect(
    page.frameLocator("[data-diff-stage] iframe").first().locator("h1"),
  ).toHaveText("Previous home");
  await expect(
    page.frameLocator("[data-diff-stage] iframe").last().locator("h1"),
  ).toHaveText("Current home");
  for (const frame of await frames.all())
    await expect(frame).toHaveAttribute("src", /\.mobile\.dark\.html$/);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  expect(failures).toEqual([]);
});
