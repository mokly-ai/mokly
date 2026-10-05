import { expect, test } from "@playwright/test";

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

test("host accent overrides and interactive overlay stay within the viewer", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.viewerHarness.start("one", { slots: true });
    document
      .getElementById("one")!
      .style.setProperty("--mokly-accent", "rgb(12, 34, 56)");
    document
      .getElementById("one")!
      .style.setProperty("--mokly-accent-contrast", "rgb(255, 255, 254)");
    document
      .getElementById("one")!
      .style.setProperty("--mokly-accent-soft", "rgb(232, 240, 244)");
  });
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  const tokens = await page.locator(".mokly-viewer").evaluate((root) => {
    const style = getComputedStyle(root);
    return [
      "--mokly-accent",
      "--mokly-accent-contrast",
      "--mokly-accent-soft",
    ].map((name) => style.getPropertyValue(name).trim());
  });
  expect(tokens).toEqual([
    "rgb(12, 34, 56)",
    "rgb(255, 255, 254)",
    "rgb(232, 240, 244)",
  ]);
  const current = page.locator('#one .mbk-nav-row[aria-current="page"]');
  await expect(current).toHaveCSS("color", "rgb(255, 255, 254)");
  expect(
    await current.evaluate(
      (row) => getComputedStyle(row, "::before").backgroundColor,
    ),
  ).toBe("rgb(12, 34, 56)");
  await expect(page.locator("#one .mbk-mark")).toHaveCSS(
    "color",
    "rgb(47, 89, 69)",
  );
  await expect(page.locator("#one .mbk-mark")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator("#one .mbk-mark-rules")).toHaveCSS(
    "stroke",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator("#one .mbk-name")).toHaveCSS(
    "font-family",
    'Georgia, "Times New Roman", serif',
  );
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    host.props.slots = {
      ...host.props.slots,
      stageOverlay: {
        content: "Interactive annotation",
        pointerEvents: "auto",
      },
    };
    host.render();
  });
  await expect(page.getByText("Interactive annotation")).toBeVisible();
  await expect(page.locator('[data-mokly-slot="stageOverlay"]')).toHaveCSS(
    "pointer-events",
    "auto",
  );
  await page.getByRole("button", { name: "Host start" }).click();
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "slot"),
    ),
  ).toHaveLength(1);
});
