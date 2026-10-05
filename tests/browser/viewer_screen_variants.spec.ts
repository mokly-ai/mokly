import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { CatalogueReadModel, ViewerSelection } from "@mokly/viewer";

import { followupFixture } from "./viewer_followup_fixture.js";
import type {} from "./viewer_harness.js";
import { screenVariantCatalogue } from "./viewer_variant_catalogue.js";

let fixture: Awaited<ReturnType<typeof followupFixture>>;

test.beforeAll(async () => {
  fixture = await followupFixture();
});

test.afterAll(async () => fixture?.close());

async function openScreenVariantViewer(page: Page, controlled: boolean) {
  const catalogue = JSON.stringify(screenVariantCatalogue(fixture.catalogue));
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ catalogue, controlled }) => {
      window.viewerHarness.start("screen-variants", {
        controlled,
        source: JSON.parse(catalogue) as CatalogueReadModel,
        defaultSelection: {
          screenPath: "home",
          view: "changes",
          viewport: "both",
          colorScheme: "light",
        },
      });
    },
    { catalogue, controlled },
  );
}

test("Changes proposes a variant screen and its first changed view atomically", async ({
  page,
}) => {
  const parent = 'a[data-nav-row][data-route="home/index.html"]';

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
      screenPath: "home/error",
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
      screenPath: "home/error",
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
