import fs from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";

import type {} from "../../packages/viewer/tests/comparison_hook_harness.js";

import { repositoryRoot } from "../helpers/fixture.js";
import { cssSchemaFixture } from "../helpers/review_css_schema.js";
import { serveStaticFiles } from "../helpers/static_server.js";

let directory: string;
let host: Awaited<ReturnType<typeof serveStaticFiles>>;
let model: string;
test.beforeAll(async () => {
  directory = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/comparison-hook-"),
  );
  await build({
    entryPoints: ["packages/viewer/tests/comparison_hook_harness.tsx"],
    outfile: path.join(directory, "hook.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2023",
    logLevel: "silent",
  });
  await fs.writeFile(
    path.join(directory, "index.html"),
    '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="/hook.js"></script></body></html>',
  );
  model = await fs.readFile("docs/protocol/fixtures/catalogue-v4.json", "utf8");
  host = await serveStaticFiles(directory);
});
test.afterAll(async () => {
  await host?.close();
  await fs.rm(directory, { recursive: true, force: true });
});

async function start(
  page: Page,
  pinned = false,
  initialSide = false,
  eligible = true,
) {
  await page.goto(host.url);
  await page.waitForFunction(() => Boolean(window.comparisonHookHarness));
  await page.evaluate(
    ({ model, review, pinned, initialSide, eligible }) =>
      window.comparisonHookHarness.start(
        JSON.parse(model),
        JSON.parse(review),
        pinned,
        initialSide,
        eligible,
      ),
    {
      model,
      review: JSON.stringify(cssSchemaFixture(4)),
      pinned,
      initialSide,
      eligible,
    },
  );
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-mode",
    initialSide && eligible ? "side" : "current",
  );
}

async function ready(page: Page, mode: string) {
  await expect(page.locator("output")).toHaveAttribute("data-hook-mode", mode);
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-busy",
    "false",
  );
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-loaded",
    "true",
  );
}

test("a newer evidence revision renews only a loaded live comparison", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ evidence: 20 }),
  );
  expect(
    await page.evaluate(() => window.comparisonHookHarness.snapshot().requests),
  ).toEqual([]);
  await page.evaluate(() => window.comparisonHookHarness.select("side"));
  await ready(page, "side");
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ evidence: 21 }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.comparisonHookHarness.snapshot().requests),
    )
    .toEqual(["GET", "HEAD"]);
  await ready(page, "side");
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ eligible: false }),
  );
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-mode",
    "current",
  );
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ evidence: 22 }),
  );
  expect(
    await page.evaluate(() => window.comparisonHookHarness.snapshot().requests),
  ).toEqual(["GET", "HEAD"]);
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ eligible: true }),
  );
  await ready(page, "side");
  expect(
    await page.evaluate(() => window.comparisonHookHarness.snapshot().requests),
  ).toEqual(["GET", "HEAD", "GET"]);
});

test("an initially unchanged view keeps Current when an eligible view follows", async ({
  page,
}) => {
  await start(page, false, true, false);
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ eligible: true }),
  );
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-mode",
    "current",
  );
  expect(
    await page.evaluate(() => window.comparisonHookHarness.snapshot().requests),
  ).toEqual([]);
});

test("a pinned comparison keeps its selected mode without evidence renewal", async ({
  page,
}) => {
  await start(page, true, true);
  await ready(page, "side");
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ evidence: 30 }),
  );
  await ready(page, "side");
  expect(
    await page.evaluate(() => window.comparisonHookHarness.snapshot().requests),
  ).toEqual(["GET"]);
});

test("a newer update resets a deep-linked mode and clears the loaded comparison", async ({
  page,
}) => {
  await start(page, false, true);
  await ready(page, "side");
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ evidence: 30, updateVersion: 2 }),
  );
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-mode",
    "current",
  );
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-loaded",
    "false",
  );
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ eligible: false }),
  );
  await page.evaluate(() =>
    window.comparisonHookHarness.update({ eligible: true }),
  );
  await expect(page.locator("output")).toHaveAttribute(
    "data-hook-mode",
    "current",
  );
  expect(
    await page.evaluate(() => window.comparisonHookHarness.snapshot().requests),
  ).toEqual(["GET"]);
});
