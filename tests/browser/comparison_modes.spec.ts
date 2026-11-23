import { expect } from "@playwright/test";

import { entryRoute } from "../../packages/viewer/src/navigation/routes.js";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  chooseFilter,
  comparisonIndex,
  modeButton,
  navRow,
  showMode,
  snapshotOf,
} from "./comparison_ui.js";
import { historicalFrame, previousVersionLabel } from "./previous_version.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
  openCatalogueSheet,
} from "./workspace_actions.js";

const stage = "[data-diff-stage]";

test("Changes and screen browsing stay lazy until a diff is selected", async ({
  page,
}) => {
  const requests: string[] = [];
  const all: string[] = [];
  const failed: string[] = [];
  page.on("request", (request) => {
    all.push(request.url());
    if (request.url().includes("/mokly-viewer/diffs/"))
      requests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseFilter(page, "changed");
  await chooseViewport(page, "mobile");
  await chooseScheme(page, "dark");
  await navRow(page, comparisonPaths.darkOnly).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Dusk screen");
  await navRow(page, comparisonPaths.changed).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  expect(requests).toEqual([]);

  await showMode(page, "Overlay", 2);
  await expect(page.locator(`${stage} .mb-panes`)).toHaveAttribute(
    "data-compare-mode",
    "overlay",
  );
  await expect(page.locator(`${stage} iframe`).first()).toHaveAttribute(
    "title",
    "Before — mobile — dark",
  );
  await expect(page.locator('button[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(requests.some((url) => url.includes("/snapshots/"))).toBe(true);
  for (const name of ["Side by side", "Difference"] as const)
    await showMode(page, name, 2);
  // Static Refresh reads the same immutable generation again.
  const sources = () =>
    page
      .locator(`${stage} iframe`)
      .evaluateAll((frames) =>
        frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
      );
  const loaded = await sources();
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect(page.locator(`${stage} iframe`)).toHaveCount(2);
  await expect.poll(sources).toEqual(loaded);
  await modeButton(page, "Current").click();
  await expect(page.locator("[data-current-screen]")).toBeVisible();
  await expect(page.locator(`${stage} iframe`)).toHaveCount(0);
  // A static host has no event stream, and nothing failed to load.
  expect(all.some((url) => url.includes("/mokly-viewer/events"))).toBe(false);
  expect(failed).toEqual([]);
});

test("unchanged views omit comparisons while changed views retain all modes", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.darkOnly}/`);
  await chooseScheme(page, "light");
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await awaitRoutedDetail(page, comparisonPaths.darkOnly);
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await chooseScheme(page, "dark");
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await chooseViewport(page, "desktop");
  await showMode(page, "Overlay", 2);
  for (const [name, mode] of [
    ["Difference", "difference"],
    ["Side by side", "side"],
  ] as const) {
    await showMode(page, name, 2);
    await expect(page.locator(`${stage} .mb-panes`)).toHaveAttribute(
      "data-compare-mode",
      mode,
    );
  }
  await chooseViewport(page, "both");
  await expect(page.locator(`${stage} iframe`)).toHaveCount(4);
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
  await awaitRoutedDetail(page, comparisonPaths.unchanged);
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(page.locator(`${stage} iframe`)).toHaveCount(0);
});

test("added and removed screens stay current without comparison controls", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  await page.goto(`/view/${comparisonPaths.added}/`);
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.added)).toBeVisible();
  await expect(page.locator("[data-workspace-status]")).toHaveText("Added");
  await awaitRoutedDetail(page, comparisonPaths.added);
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page
      .frameLocator(canvasFrame("desktop"))
      .getByRole("heading", { name: "Added screen" }),
  ).toBeVisible();

  const snapshot = snapshotOf(index, comparisonPaths.removedScreen);
  await page.goto(
    `/view/${comparisonPaths.removedScreen}/?snapshot=${snapshot}`,
  );
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.removedScreen)).toBeVisible();
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await awaitRoutedDetail(page, comparisonPaths.removedScreen);
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(page.locator("[data-current-screen]")).toHaveCount(0);
  await expect(previousVersionLabel(page)).toHaveText(
    "Showing previous version",
  );
  await expect(
    historicalFrame(page, "desktop")
      .locator("iframe")
      .contentFrame()
      .getByRole("heading", { name: "Historical screen" }),
  ).toBeVisible();
});

test("snapshot panes keep marked links inert", async ({ page }) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Side by side", 2);
  const iframe = page.locator(`${stage} .mb-pane--before iframe`);
  const source = await iframe.getAttribute("data-mokly-preview-source");
  const before = page.url();
  await iframe.contentFrame().locator("#snapshot-link").click();
  await expect(page).toHaveURL(before);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await expect(iframe.contentFrame().locator("h1")).toHaveText("Before screen");
  await expect(iframe).toHaveAttribute("data-mokly-preview-source", source!);
  expect(
    await iframe.evaluate(
      (frame: HTMLIFrameElement) => frame.contentDocument?.URL,
    ),
  ).toBe("about:srcdoc");
});

test("a desktop pane's address pill copies its address from its copy icon", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedUrl?: string }).__copiedUrl = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Side by side", 2);
  const icon = page.locator(`${stage} .browser-bar .address-copy svg`).first();
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box?.width).toBe(13);
  expect(box?.height).toBe(13);

  await icon.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedUrl?: string }).__copiedUrl,
      ),
    )
    .toBe(entryRoute(comparisonPaths.changed));
  await expect(page.locator(".address-copied").first()).toHaveText(
    "URL copied",
  );
});

test("narrow diffs fit the shell and retain the catalogue drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "mobile");
  await showMode(page, "Overlay", 2);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await openCatalogueSheet(page);
  await expect(navRow(page, comparisonPaths.unchanged)).toBeVisible();
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
});

test("mode switches keep frames and focus and cannot expand one side alone", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
  await showMode(page, "Overlay", 2);
  const frame = await page.locator(`${stage} iframe`).first().elementHandle();
  expect(frame).not.toBeNull();
  await expect(page.locator(`${stage} .browser-expand`)).toHaveCount(0);
  await modeButton(page, "Difference").click();
  await expect(modeButton(page, "Difference")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await frame?.evaluate((node) => node.isConnected)).toBe(true);
  await frame?.dispose();
  // Keyboard activation keeps focus on the pressed mode.
  for (const name of [
    "Side by side",
    "Overlay",
    "Difference",
    "Current",
  ] as const) {
    await modeButton(page, name).focus();
    await page.keyboard.press("Enter");
    await expect(modeButton(page, name)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(modeButton(page, name)).toBeFocused();
  }
});
