/**
 * Mount states of the standalone shell over Serve of the example, under the
 * shell delivery and viewer namespace contracts: a failed index read shows
 * the catalogue failure state with Try again, and an index or a detail of
 * another version shows the compatible-viewer headline with Reload, and no
 * navigation or frame.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { networkFailure, versionFailure } from "./shell_error_allowances.js";
import { route, titles, WELCOME } from "./shell_route_fixture.js";

test("a failed catalogue read shows its failure state, and Try again installs the catalogue", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  allowBrowserError(networkFailure(baseURL!, "/mokly-viewer/index.json"));
  const names = await titles(request);
  let reads = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/mokly-viewer/index.json", async (held) => {
    reads += 1;
    if (reads === 1) return held.abort("failed");
    await released;
    await held.continue();
  });
  await page.goto(route(WELCOME));
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "The catalogue could not be loaded" });
  await expect(alert).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Catalogue" });
  await expect(navigation).toHaveCount(0);
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status")).toHaveText("Loading catalogue…");
  await expect(page.locator('[aria-busy="true"]')).toBeFocused();
  await expect(navigation).toHaveCount(0);
  release();
  await expect(page.locator("#mb-main h2")).toHaveText(names.get(WELCOME)!);
  await expect(navigation).toBeVisible();
  await expect(page.locator("#mb-main iframe")).toHaveCount(2);
  expect(reads).toBe(2);
});

for (const [boundary, path, version, supported] of [
  ["catalogue", "/mokly-viewer/index.json", 7, 9],
  ["detail", `/mokly-viewer/entries/${WELCOME}.json`, 2, 4],
] as const)
  test(`an unsupported ${boundary} version shows the compatible-viewer headline`, async ({
    page,
    baseURL,
    allowBrowserError,
  }) => {
    allowBrowserError(versionFailure(baseURL!, boundary, version, supported));
    await page.route(`**${path}`, async (held) => {
      const response = await held.fetch();
      const body = (await response.json()) as Record<string, unknown>;
      await held.fulfill({
        response,
        json: { ...body, schemaVersion: version },
      });
    });
    await page.goto(route(WELCOME));
    await expect(
      page.getByText("This catalogue needs a compatible viewer"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Catalogue" }),
    ).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
  });
