import { expect } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;

test.beforeAll(async () => {
  fixture = await viewerFixture();
});

test.afterAll(async () => {
  await fixture?.close();
});

test("outside clicks close embedded pickers and expanded frames with conditional focus return", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() =>
    window.viewerHarness.start("one", {
      defaultSelection: { viewport: "desktop" },
      slots: true,
    }),
  );
  const toggle = page.getByRole("button", { name: "Filter by tag" });
  const panel = page.getByRole("group", { name: "Tags", exact: true });
  const search = page.getByRole("searchbox", { name: "Search catalogue" });

  await toggle.click();
  await expect(panel).toBeVisible();
  await search.click();
  await expect(panel).toBeHidden();
  await expect(search).toBeFocused();

  await toggle.click();
  await expect(panel.getByRole("button", { name: "forms" })).toBeFocused();
  // dispatchEvent keeps focus inside the panel, unlike a physical button click.
  await page
    .getByRole("heading", { name: "Home", exact: true })
    .dispatchEvent("click");
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();

  await toggle.click();
  await page.getByRole("button", { name: "Host start" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Host start" })).toBeFocused();

  await toggle.click();
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.textContent = "Outside host";
    document.body.prepend(button);
  });
  await page.getByRole("button", { name: "Outside host" }).click();
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Outside host" }),
  ).toBeFocused();

  await page
    .getByRole("button", { name: "Expand to a wider viewport" })
    .click();
  await expect(
    page.getByRole("button", { name: "Collapse viewport" }),
  ).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(
    page.getByRole("button", { name: "Expand to a wider viewport" }),
  ).toBeVisible();
});
