import { expect } from "@playwright/test";

import { browserSources } from "../../packages/viewer/tests/browser_sources.js";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
import { openPanelSheet } from "./workspace_actions.js";
let server: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  server = await serveCatalogue({
    "specs/index.mockup.tsx": browserSources({
      body: '<pane.Component><p>Screen content</p><action.Component label="Slot action" /></pane.Component><action.Component moklyInstance="footer" label="Finish" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><MockLink to="action">Open Action</MockLink>',
    }),
  });
});
test.afterAll(async () => server?.close());
test("screen inspection records real nested, repeated and hidden instances with native range markers", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/home/`);
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

test("the right panel holds the inspector, and the compact layout's panel sheet expands and keeps the page bounded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/view/pane/`);
  // From the layout breakpoint up the right panel holds the inspector, which
  // scrolls with the panel and has no divider of its own.
  const panel = page.getByRole("region", { name: "Panel", exact: true });
  await expect(panel.locator("[data-workspace-inspector]")).toBeVisible();
  await expect(
    page.getByRole("separator", { name: "Resize inspector" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeHidden();
  await openPanelSheet(page);
  await expect(panel.locator("[data-workspace-inspector]")).toBeVisible();
  const compact = (await panel.boundingBox())!.height;
  await page.getByRole("button", { name: "Expand panel", exact: true }).click();
  await expect
    .poll(async () => (await panel.boundingBox())!.height)
    .toBeGreaterThan(compact);
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
  await page.goto(`${server.url}/view/pane/`);
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
  // At rest the inspector grip draws the Light control edge, while the
  // navigation grip keeps its strong border; both share the line and shadow.
  expect(resting).toEqual({
    ...(await dividers.navigation.evaluate(grip)),
    background: "rgb(98, 106, 100)",
  });

  const box = (await dividers.inspector.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const hovered = await dividers.inspector.evaluate(grip);
  expect(hovered).not.toEqual(resting);
  await dividers.navigation.hover();
  expect(await dividers.navigation.evaluate(grip)).toEqual(hovered);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 8 });
  await expect(page.locator(".mbk[data-mokly-shell]")).toHaveClass(
    /mbk-inspector-resizing/,
  );
  await page.mouse.up();
  await expect(page.locator(".mbk[data-mokly-shell]")).not.toHaveClass(
    /mbk-inspector-resizing/,
  );
});
