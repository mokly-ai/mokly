/**
 * The compact layout's frame pick in an embedded root, under the canvas stage
 * and viewer selection contracts: a pick of another row's frame of a variant
 * set opens that row in the picked scheme, as one selection change, so a
 * controlled host hears one proposal.
 */

import { expect } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import { test } from "./browser_test.js";
import { markerFixture } from "./viewer_marker_fixture.js";
import { NARROW_WINDOW } from "./workspace_actions.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof markerFixture>>;
test.beforeAll(async () => {
  fixture = await markerFixture();
});
test.afterAll(async () => fixture?.close());

test("a controlled host hears one proposal with the row and the scheme of a picked frame", async ({
  page,
}) => {
  await page.setViewportSize(NARROW_WINDOW);
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  // The host takes each proposal as its selection.
  await page.evaluate(() =>
    window.viewerHarness.start("one", {
      controlled: true,
      accept: true,
      defaultSelection: {
        screenPath: "pane/default",
        viewport: "desktop",
        colorScheme: "light",
      },
    }),
  );
  const picker = page.locator('#one select[aria-label="Frame"]');
  await expect(picker).toHaveValue("pane/default:light");
  await picker.selectOption({ label: "Second · Dark" });
  // The picked row opens in the picked scheme, which keeps its frame picked.
  await expect(picker).toHaveValue("pane/second:dark");
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection")
        .map((event) => {
          const value = event.value as ViewerSelection;
          return [value.screenPath, value.colorScheme];
        }),
    ),
  ).toEqual([["pane/second", "dark"]]);
});
