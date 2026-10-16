import { expect } from "@playwright/test";

import type { CatalogueReadModel, MoklyViewerProps } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";

declare global {
  interface Window {
    sourceProbe: {
      calls: number;
      aborted: number;
      processed: boolean;
      release(): void;
    };
  }
}
let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => fixture?.close());
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

test("replacing a URL source cancels its stale load and rejects a late success", async ({
  page,
}) => {
  await page.evaluate((serialized) => {
    const index = JSON.parse(serialized) as CatalogueReadModel;
    const original = window.fetch;
    const probe: Window["sourceProbe"] = (window.sourceProbe = {
      calls: 0,
      aborted: 0,
      processed: false,
      release: () => {},
    });
    window.fetch = (input, init) => {
      if (!String(input).endsWith("/held-index.json"))
        return original(input, init);
      probe.calls++;
      init?.signal?.addEventListener("abort", () => {
        probe.aborted++;
      });
      return new Promise((resolve) => {
        probe.release = () => {
          const response = Response.json(index);
          const json = response.json.bind(response);
          response.json = async () => {
            const body = await json();
            probe.processed = true;
            return body;
          };
          resolve(response);
        };
      });
    };
    window.viewerHarness.start("one", {
      source: new URL("/held-index.json", location.href),
    });
  }, JSON.stringify(fixture.index));
  await expect
    .poll(() => page.evaluate(() => window.sourceProbe.calls))
    .toBe(1);
  await page.evaluate((serialized) => {
    const index = JSON.parse(serialized) as CatalogueReadModel;
    const host = window.viewerHarness.get("one");
    const latest = structuredClone(index);
    latest.screens.find((entry) => entry.path === "home")!.title =
      "Latest home";
    host.props = {
      ...host.props,
      index: latest,
      baseUrl: location.origin,
    } as MoklyViewerProps;
    host.render();
  }, JSON.stringify(fixture.index));
  await expect(
    page.getByRole("heading", { name: "Latest home", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.sourceProbe.aborted))
    .toBe(1);
  await page.evaluate(() => window.sourceProbe.release());
  await expect
    .poll(() => page.evaluate(() => window.sourceProbe.processed))
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page
      .getByRole("heading", { name: "Latest home", exact: true })
      .isVisible(),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error"),
    ),
  ).toEqual([]);
});

test("StrictMode starts one URL source transport across effect replay", async ({
  page,
}) => {
  await page.evaluate((serialized) => {
    const index = JSON.parse(serialized) as CatalogueReadModel;
    const original = window.fetch;
    const probe: Window["sourceProbe"] = (window.sourceProbe = {
      calls: 0,
      aborted: 0,
      processed: false,
      release: () => {},
    });
    window.fetch = (input, init) => {
      if (!String(input).endsWith("/strict-index.json"))
        return original(input, init);
      probe.calls++;
      init?.signal?.addEventListener("abort", () => {
        probe.aborted++;
      });
      return Promise.resolve(Response.json(index));
    };
    window.viewerHarness.start("one", {
      strict: true,
      source: new URL("/strict-index.json", location.href),
    });
  }, JSON.stringify(fixture.index));
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.sourceProbe.calls)).toBe(1);
  await page.evaluate(async () => {
    window.viewerHarness.get("one").render();
    await new Promise(requestAnimationFrame);
  });
  expect(await page.evaluate(() => window.sourceProbe.calls)).toBe(1);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error"),
    ),
  ).toEqual([]);
  await page.evaluate(() => window.viewerHarness.remove("one"));
  await expect
    .poll(() => page.evaluate(() => window.sourceProbe.aborted))
    .toBe(1);
  await expect(page.locator("#one")).toHaveCount(0);
});
