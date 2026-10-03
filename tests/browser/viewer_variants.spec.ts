import { expect, test } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import {
  openScreenVariantViewer,
  startSuite,
  stopSuite,
} from "./viewer_variants_fixture.js";

test.beforeAll(startSuite);

test.afterAll(stopSuite);

test("Changes proposes a variant screen and its first changed view atomically", async ({
  page,
}) => {
  const parent = 'a[data-nav-row][data-route="screens/home.html"]';

  await openScreenVariantViewer(page, false);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("screen-variants")
        .events.filter((event) => event.name === "error"),
    ),
  ).toEqual([]);
  await page.locator(parent).click();
  await expect(page.locator("#screen-variants h2")).toHaveText("Save failed");
  const committed = await page.evaluate(() =>
    window.viewerHarness
      .get("screen-variants")
      .events.find((event) => event.name === "selection"),
  );
  expect(committed?.value).toEqual(
    expect.objectContaining({
      screenId: "home-error",
      viewport: "mobile",
      colorScheme: "dark",
    }),
  );

  await page.reload();
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await openScreenVariantViewer(page, true);
  await page.locator(parent).click();
  await expect(page.locator("#screen-variants h2")).toHaveText("Home");
  const proposal = await page.evaluate(
    () =>
      window.viewerHarness
        .get("screen-variants")
        .events.find((event) => event.name === "selection")?.value,
  );
  expect(proposal).toEqual(
    expect.objectContaining({
      screenId: "home-error",
      viewport: "mobile",
      colorScheme: "dark",
    }),
  );
  await page.evaluate((selection) => {
    window.viewerHarness
      .get("screen-variants")
      .setSelection(selection as ViewerSelection);
  }, proposal);
  await expect(page.locator("#screen-variants h2")).toHaveText("Save failed");
});
