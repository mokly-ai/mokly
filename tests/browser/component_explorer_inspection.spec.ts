import { expect, test } from "@playwright/test";

import type { RunningServer } from "../../dist/server/http_types.js";

import { createExplorerFixture } from "./component_explorer_fixture.js";

let server: RunningServer;
let close: () => Promise<void>;
test.beforeAll(async () => {
  const fixture = await createExplorerFixture();
  server = fixture.server;
  close = fixture.close;
});
test.afterAll(async () => close());

test("screen inspection records real nested, repeated and hidden instances without listing the screen in Changes", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await expect(
    page.locator('[data-nav-row][data-route="screens/home.html"]'),
  ).not.toHaveAttribute("data-changed", "true");
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Components", exact: true }),
  ).toContainText("5 instances");
  const highlight = page.getByRole("button", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeEnabled();
  await highlight.click();
  await expect(
    page.locator('.mbk-highlight-layer[data-highlight-viewport="desktop"]'),
  ).toBeVisible();
  await expect(
    page.locator(".mbk-highlight-label").filter({ hasText: "hidden" }),
  ).toHaveCount(0);
  await page
    .locator(".mbk-highlight-label")
    .filter({ hasText: "footer" })
    .first()
    .click();
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("Finish");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(highlight).toBeFocused();
  await page.getByRole("link", { name: "Open component", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
});

test("desktop divider stays centered while resizing and mobile sheet keeps the page bounded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/view/components/pane.html`);
  const divider = page.getByRole("separator", { name: "Resize inspector" });
  await expect(divider).toBeVisible();
  const before = await page.locator("[data-workspace-inspector]").boundingBox();
  const handle = await divider.boundingBox();
  expect(
    Math.abs(handle!.y + handle!.height / 2 - before!.y),
  ).toBeLessThanOrEqual(1);
  await divider.focus();
  await page.keyboard.press("ArrowUp");
  const after = await page.locator("[data-workspace-inspector]").boundingBox();
  expect(after!.height).toBeGreaterThan(before!.height);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(divider).toBeHidden();
  const sheet = page.getByRole("button", {
    name: "Expand inspector",
    exact: true,
  });
  await expect(sheet).toBeVisible();
  const compact = await page
    .locator("[data-workspace-inspector]")
    .boundingBox();
  await sheet.click();
  const expanded = await page
    .locator("[data-workspace-inspector]")
    .boundingBox();
  expect(expanded!.height).toBeGreaterThan(compact!.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
});

test("the inspector divider lights up like the navigation divider", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/view/components/pane.html`);
  await page.addStyleTag({
    content: "*, *::after { transition: none !important; }",
  });
  const grip = (node: Element) => {
    const style = getComputedStyle(node, "::after");
    return {
      background: style.backgroundColor,
      shadow: style.boxShadow,
      line: [style.width, style.height].sort().join(" "),
    };
  };
  const dividers = {
    navigation: page.getByRole("separator", {
      name: "Resize navigation panel",
    }),
    inspector: page.getByRole("separator", { name: "Resize inspector" }),
  };
  await expect(dividers.inspector).toBeVisible();
  const resting = await dividers.inspector.evaluate(grip);
  expect(resting).toEqual(await dividers.navigation.evaluate(grip));

  const box = (await dividers.inspector.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const hovered = await dividers.inspector.evaluate(grip);
  expect(hovered).not.toEqual(resting);
  await dividers.navigation.hover();
  expect(await dividers.navigation.evaluate(grip)).toEqual(hovered);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 8 });
  await expect(page.locator("[data-mokly-shell]")).toHaveClass(
    /mbk-inspector-resizing/,
  );
  await page.mouse.up();
  await expect(page.locator("[data-mokly-shell]")).not.toHaveClass(
    /mbk-inspector-resizing/,
  );
});
