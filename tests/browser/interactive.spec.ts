import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  interactiveFixture,
  interactiveServeFixture,
  mountInteractiveFrame,
  type InteractiveTestWindow,
} from "./interactive_fixture.js";

let fixture: Awaited<ReturnType<typeof interactiveFixture>>;
let serveFixture: Awaited<ReturnType<typeof interactiveServeFixture>>;

test.beforeAll(async () => {
  fixture = await interactiveFixture();
  serveFixture = await interactiveServeFixture();
});

test.afterAll(async () => {
  await fixture?.close();
  await serveFixture?.close();
});

test("Live mounts state and sends MockLink navigation through the frame adapter", async ({
  page,
}) => {
  await mountInteractiveFrame(page, serveFixture);
  const frame = page.frameLocator("#frame");
  const count = frame.locator("#count");

  await expect(frame.locator("body")).toHaveAttribute(
    "data-mokly-viewport",
    "mobile",
  );
  await expect(frame.locator("[data-live-provider=light]")).toHaveCount(1);
  await expect(count).toHaveText("Saved: 0 items");
  await frame.locator("#increment").click();
  await expect(count).toHaveText("Saved: 1 items");
  await expect(frame.locator("#raw-link")).toHaveAttribute(
    "href",
    "../../screens/details.mobile.html",
  );
  const initialPath = await frame
    .locator("body")
    .evaluate(() => location.pathname);
  await frame.locator("#raw-link").click();
  await expect.poll(() => navigationIds(page)).toEqual(["details"]);
  expect(await frame.locator("body").evaluate(() => location.pathname)).toBe(
    initialPath,
  );
  await frame.locator("#toggle-raw-link").click();
  await expect(frame.locator("#raw-link")).toHaveAttribute("href", "/outside");
  await expect(frame.locator("#raw-link")).not.toHaveAttribute(
    "data-mokly-inspector-link",
    /.+/,
  );
  expect(
    await frame.locator("body").evaluate((body) => body.innerHTML),
  ).not.toContain("mokly-review");
  await page.waitForTimeout(100);
  expect(serveFixture.diagnostics).toEqual([]);

  await frame.locator("#mock-link").click();
  await expect.poll(() => navigationIds(page)).toEqual(["details", "details"]);
  await expect(count).toHaveText("Saved: 1 items");
  expect(await frame.locator("body").evaluate(() => location.pathname)).toBe(
    initialPath,
  );

  await frame.locator("#child-link").click();
  await expect
    .poll(() => navigationIds(page))
    .toEqual(["details", "details", "details"]);
  await expect(count).toHaveText("Saved: 1 items");
  expect(await frame.locator("body").evaluate(() => location.pathname)).toBe(
    initialPath,
  );
});

test("Live component render runs inside renderer providers", async ({
  page,
}) => {
  await mountInteractiveFrame(page, fixture, fixture.providerPath);

  await expect(
    page.frameLocator("#frame").locator("#provider-value"),
  ).toHaveText("provider-light");
  expect(fixture.diagnostics).toEqual([]);
});

test("Live reports a bounded root render error to its generation endpoint", async ({
  page,
}) => {
  fixture.diagnostics.length = 0;
  await mountInteractiveFrame(page, fixture, fixture.errorPath);
  const frame = page.frameLocator("#frame");
  const initialPath = await frame
    .locator("body")
    .evaluate(() => location.pathname);

  await expect.poll(() => fixture.diagnostics.length).toBe(1);
  await expect(frame.locator("#static-error-fallback")).toHaveText(
    "Static error fallback",
  );
  await expect(frame.locator("body")).toHaveAttribute(
    "data-mokly-viewport",
    "mobile",
  );
  await expect(frame.locator("#body-retained-style")).toHaveCount(1);
  await expect(frame.locator("#body-retained-script")).toHaveCount(1);
  expect(fixture.diagnostics[0]).toEqual({
    body: {
      code: "render-error",
      colorScheme: "light",
      entryId: "broken",
      entryKind: "screen",
      message: "browser render exploded",
      viewport: "mobile",
    },
    pathname: "/__mokly/interactive/browser_generation/diagnostics",
  });
  await frame.locator("#static-error-link").click();
  await expect.poll(() => navigationIds(page)).toEqual(["details"]);
  expect(await frame.locator("body").evaluate(() => location.pathname)).toBe(
    initialPath,
  );
  await page.waitForTimeout(100);
  expect(fixture.diagnostics).toHaveLength(1);
});

test("Live reports pre-mount failures without replacing static content", async ({
  page,
}) => {
  fixture.diagnostics.length = 0;
  await mountInteractiveFrame(page, fixture, fixture.preMountPath);
  const frame = page.frameLocator("#frame");

  await expect.poll(() => fixture.diagnostics.length).toBe(1);
  await expect(frame.locator("#static-pre-mount")).toHaveText(
    "Static pre-mount fallback",
  );
  expect(fixture.diagnostics[0]).toEqual({
    body: {
      code: "render-error",
      colorScheme: "light",
      entryId: "missing-entry",
      entryKind: "screen",
      message: "Live entry is missing from the browser registry.",
      viewport: "mobile",
    },
    pathname: "/__mokly/interactive/browser_generation/diagnostics",
  });
});

test("Live does not warn that static JSX siblings need keys", async ({
  page,
}) => {
  const warnings = reactKeyWarnings(page);
  await mountInteractiveFrame(page, fixture, fixture.staticChildrenPath);

  await expect(
    page.frameLocator("#frame").locator("#static-children span"),
  ).toHaveText(["First", "Second"]);
  expect(warnings).toEqual([]);
});

test("Live still warns for an unkeyed dynamic JSX list", async ({ page }) => {
  const warnings = reactKeyWarnings(page);
  await mountInteractiveFrame(page, fixture, fixture.dynamicChildrenPath);

  await expect(
    page.frameLocator("#frame").locator("#dynamic-children span"),
  ).toHaveText(["First", "Second"]);
  await expect.poll(() => warnings.length).toBe(1);
  expect(warnings[0]).toContain(
    'Each child in a list should have a unique "key" prop.',
  );
});

async function navigationIds(page: Page) {
  return page.evaluate(() =>
    (window as unknown as InteractiveTestWindow).frameEvents.flatMap((event) =>
      event.type === "navigation" ? [event.navigation.id] : [],
    ),
  );
}

function reactKeyWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      message.text().includes("Each child in a list should have a unique")
    )
      warnings.push(message.text());
  });
  return warnings;
}
