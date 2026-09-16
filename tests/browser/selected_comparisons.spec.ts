import { expect, test } from "@playwright/test";

import type { RunningServer } from "../../dist/server/http_types.js";

import { loadComparison } from "./comparison_actions.js";
import { selectedComparisonFixture } from "./selected_comparison_fixture.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

let server: RunningServer;
const cleanup: (() => Promise<void>)[] = [];
test.beforeAll(async () => {
  server = await selectedComparisonFixture({
    after: (dispose) => cleanup.push(dispose),
  });
});
test.afterAll(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
});

test("live Difference requests the active screen and keeps real before/current panes", async ({
  page,
}) => {
  const requests: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/__mokly/diffs/review.json") requests.push(url);
  });
  await page.goto(`${server.url}/view/screens/home.html`);
  await chooseViewport(page, "desktop");
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "Difference", exact: true }).click();
  await expect(
    page.frameLocator(".mb-pane--before iframe").locator("main"),
  ).toContainText("Screen content");
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator("main"),
  ).toContainText("Updated screen");
  expect(requests).toHaveLength(1);
  expect(requests[0]!.searchParams.get("route")).toBe("screens/home.html");
  expect(requests[0]!.searchParams.has("variant")).toBe(false);
  await expect(page.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  await expect(page.locator(".mb-pane--before iframe")).toHaveAttribute(
    "sandbox",
    "",
  );
  await chooseScheme(page, "dark");
  await expect(
    page.frameLocator(".mb-pane--after iframe").locator("main"),
  ).toContainText("Updated screen");
  expect(requests).toHaveLength(1);
});

test("saved variant selection and refresh keep the selected comparison scope", async ({
  page,
}) => {
  const requests: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/__mokly/diffs/review.json") requests.push(url);
  });
  await page.goto(`${server.url}/view/components/action.html`);
  await chooseViewport(page, "mobile");
  await page
    .getByLabel("Saved variant", { exact: true })
    .selectOption("disabled");
  await expect(page).toHaveURL(/variant=disabled/);
  await loadComparison(page, "Overlay");
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
  await loadComparison(page, "Refresh comparison");
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(request.searchParams.get("route")).toBe("components/action.html");
    expect(request.searchParams.get("variant")).toBe("disabled");
  }
  expect(requests[1]!.searchParams.get("refresh")).toBe("1");
  await page
    .getByLabel("Saved variant", { exact: true })
    .selectOption("default");
  await expect(page).toHaveURL(/variant=default/);
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(
    page
      .frameLocator(".mb-pane--after iframe")
      .getByRole("button", { name: "Proceed", exact: true }),
  ).toBeEnabled();
  expect(requests.at(-1)!.searchParams.get("variant")).toBe("default");
});
