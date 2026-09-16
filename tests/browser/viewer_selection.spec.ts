import { expect, test } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

test("invalid initial and incoming selection report a safe state without crashing React", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    window.viewerHarness.start("one", {
      strict: true,
      defaultSelection: { viewport: "tablet" },
    }),
  );
  await expect(page.locator("#one [role=alert]")).toBeVisible();
  expect(
    await page.evaluate(() => window.viewerHarness.get("one").events),
  ).toEqual([
    {
      name: "error",
      value: {
        code: "selection",
        message: "The requested catalogue selection is unavailable.",
      },
    },
  ]);
  await page.evaluate(() =>
    window.viewerHarness.start("two", { controlled: true }),
  );
  await expect(page.locator("#two h2")).toHaveText("Home");
  await page.evaluate(() => {
    const host = window.viewerHarness.get("two");
    host.setSelection({
      ...host.props.selection!,
      viewport: "tablet",
    } as unknown as ViewerSelection);
  });
  await expect(page.locator("#two [role=alert]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("shell links retain variants and fragments and unchanged variants do not emit", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  const action = page.getByRole("link", { name: "Action", exact: true });
  await action.evaluate((link) => {
    (link as HTMLAnchorElement).href += "?variant=disabled&fragment=details";
  });
  await action.click();
  await expect(
    page.getByRole("combobox", { name: "Saved variant" }),
  ).toHaveValue("disabled");
  await expect
    .poll(() =>
      page
        .locator('iframe[data-workspace-frame="mobile"]')
        .evaluate((frame) => (frame as HTMLIFrameElement).contentDocument?.URL),
    )
    .toMatch(/disabled\.mobile\.html#details$/);
  await page
    .getByRole("combobox", { name: "Saved variant" })
    .dispatchEvent("change");
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((e) => e.name === "navigate")
        .map((e) => e.value),
    ),
  ).toEqual([
    {
      screenId: "action",
      route: "components/action.html",
      variantId: "disabled",
      fragment: "details",
    },
  ]);
});
