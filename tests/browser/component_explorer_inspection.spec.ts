import { expect } from "@playwright/test";

import { browserSources } from "../../packages/viewer/tests/browser_sources.js";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
import { openPanelSheet, setFrames, zoomToTags } from "./workspace_actions.js";
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
  const components = page.locator('[data-inspect-section="components"]');
  await components.locator(":scope > summary").click();
  await expect(components).toContainText("5 instances");
  // The highlight labels show where the canvas draws its frames at 60% of
  // their size or more; the Mobile · Light frame alone fits the stage there.
  await setFrames(page, { desktop: false, mobile: true, dark: false });
  await zoomToTags(page);
  const highlight = page.getByRole("switch", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeEnabled();
  await highlight.click();
  await expect(
    page.locator('.mbk-highlight-layer[data-highlight-viewport="mobile"]'),
  ).toBeVisible();
  await expect(
    page.locator(".mbk-highlight-label").filter({ hasText: "hidden" }),
  ).toHaveCount(0);
  await page
    .locator(".mbk-highlight-label")
    .filter({ hasText: "footer" })
    .first()
    .click();
  // A press on a label selects its instance, and Inspect's Selection names
  // its props and opens its component.
  const selection = page.locator('[data-inspect-section="selection"]');
  await expect(selection).toContainText("Finish");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(highlight).toBeFocused();
  await selection.getByRole("link", { name: "Action", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
});

test("the right panel holds Inspect, and the compact layout's panel sheet expands and keeps the page bounded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/view/pane/`);
  // From the layout breakpoint up the right panel holds its tabs and
  // Inspect, which scrolls with the panel and has no divider of its own.
  const panel = page.getByRole("region", { name: "Panel", exact: true });
  const inspect = panel.getByRole("tabpanel", { name: "Inspect" });
  await expect(inspect).toBeVisible();
  await expect(panel.getByRole("separator")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeHidden();
  await openPanelSheet(page);
  await expect(inspect).toBeVisible();
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

test("the navigation divider lights up on hover and marks its root while it drags", async ({
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
  const divider = page.getByRole("separator", {
    name: "Resize navigation panel",
  });
  await expect(divider).toBeVisible();
  const resting = await divider.evaluate(grip);

  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const hovered = await divider.evaluate(grip);
  expect(hovered).not.toEqual(resting);

  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
    steps: 8,
  });
  await expect(page.locator(".mbk[data-mokly-shell]")).toHaveClass(
    /mbk-nav-resizing/,
  );
  await page.mouse.up();
  await expect(page.locator(".mbk[data-mokly-shell]")).not.toHaveClass(
    /mbk-nav-resizing/,
  );
});
