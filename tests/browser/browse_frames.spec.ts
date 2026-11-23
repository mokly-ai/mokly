import { expect } from "@playwright/test";

import {
  computedStyle,
  darkSurface,
  desktopFrame,
  expectSchemeSelected,
  mobileFrame,
  overlayStyle,
  shellRoot,
  tourRow,
} from "./browse_assertions.js";
import { test } from "./browser_test.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
  expectFrameSource,
  NARROW_WINDOW,
} from "./workspace_actions.js";

const WELCOME = "/view/example/screens/welcome/";

test("the viewport choice keeps one column of canvas frames", async ({
  page,
}) => {
  await page.goto(WELCOME);
  await expect(
    page.locator(".mbk-screen-head [data-workspace-viewport]"),
  ).toBeVisible();
  await expect(page.locator(".mbk-viewbar")).toHaveCount(0);
  const frames = (viewport: "desktop" | "mobile") => [
    page.locator(canvasFrame(viewport, "light")),
    page.locator(canvasFrame(viewport, "dark")),
  ];
  for (const frame of [...frames("mobile"), ...frames("desktop")])
    await expect(frame).toBeVisible();
  await chooseViewport(page, "mobile");
  for (const frame of frames("mobile")) await expect(frame).toBeVisible();
  for (const frame of frames("desktop")) await expect(frame).toBeHidden();
  await chooseViewport(page, "desktop");
  for (const frame of frames("mobile")) await expect(frame).toBeHidden();
  for (const frame of frames("desktop")) await expect(frame).toBeVisible();
});

test("each canvas frame keeps its own scheme and surface through the Appearance", async ({
  page,
}) => {
  await page.goto(WELCOME);
  const expectOwnSchemes = async () => {
    await expectFrameSource(
      page.locator(canvasFrame("mobile", "light")),
      /example\/screens\/welcome\/index\.mobile\.html$/,
    );
    await expectFrameSource(
      page.locator(canvasFrame("mobile", "dark")),
      /example\/screens\/welcome\/index\.mobile\.dark\.html$/,
    );
    await expectFrameSource(
      page.locator(canvasFrame("desktop", "light")),
      /example\/screens\/welcome\/index\.desktop\.html$/,
    );
    await expectFrameSource(
      page.locator(canvasFrame("desktop", "dark")),
      /example\/screens\/welcome\/index\.desktop\.dark\.html$/,
    );
    // A dark frame paints the dark preview surface behind its document.
    expect(
      await computedStyle(
        page,
        canvasFrame("desktop", "dark"),
        "backgroundColor",
      ),
    ).toBe(darkSurface);
  };
  await expectOwnSchemes();
  await expectSchemeSelected(page, "light");

  await chooseScheme(page, "dark");
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectOwnSchemes();

  await chooseScheme(page, "light");
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "light",
  );
  await expectOwnSchemes();
});

test("dark device screens keep their surface and edge", async ({ page }) => {
  // Device chrome stays on the one-frame stage below the layout breakpoint.
  await page.setViewportSize(NARROW_WINDOW);
  await page.goto(WELCOME);
  const phoneScreen = ".mbk-frame-mobile .phone-screen";
  expect(await overlayStyle(page, phoneScreen, "boxShadow")).toBe("none");

  await chooseScheme(page, "dark");
  expect(await computedStyle(page, phoneScreen, "boxShadow")).toBe("none");
  expect(await overlayStyle(page, phoneScreen, "position")).toBe("absolute");
  expect(await overlayStyle(page, phoneScreen, "boxShadow")).toContain("inset");
  expect(await computedStyle(page, mobileFrame, "backgroundColor")).toBe(
    darkSurface,
  );
  expect(await computedStyle(page, desktopFrame, "backgroundColor")).toBe(
    darkSurface,
  );
  expect(
    await computedStyle(page, ".browser-viewport", "backgroundColor"),
  ).toBe(darkSurface);
});

test("the viewport choice keeps the canvas frames mounted with their sources", async ({
  page,
}) => {
  await page.goto(WELCOME);
  const mobile = await page
    .locator(canvasFrame("mobile", "dark"))
    .elementHandle();
  const desktop = await page
    .locator(canvasFrame("desktop", "dark"))
    .elementHandle();
  expect(mobile).not.toBeNull();
  expect(desktop).not.toBeNull();

  await chooseViewport(page, "mobile");
  expect(await mobile?.evaluate((node) => node.isConnected)).toBe(true);
  expect(await desktop?.evaluate((node) => node.isConnected)).toBe(true);
  await expectFrameSource(
    page.locator(canvasFrame("mobile", "dark")),
    /example\/screens\/welcome\/index\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(canvasFrame("desktop", "dark")),
    /example\/screens\/welcome\/index\.desktop\.dark\.html$/,
  );

  await mobile?.dispose();
  await desktop?.dispose();
});

test("the viewport choice keeps a variant set's frames mounted", async ({
  page,
}) => {
  await page.goto("/view/example/components/action/");
  // A component's frames show its desktop views, row by row.
  const own = '[data-workspace-variant="example/components/action"]';
  const light = await page
    .locator(`${canvasFrame("desktop", "light")}${own}`)
    .elementHandle();
  const dark = await page
    .locator(`${canvasFrame("desktop", "dark")}${own}`)
    .elementHandle();
  expect(light).not.toBeNull();
  expect(dark).not.toBeNull();

  await chooseViewport(page, "mobile");
  expect(await light?.evaluate((node) => node.isConnected)).toBe(true);
  expect(await dark?.evaluate((node) => node.isConnected)).toBe(true);

  await light?.dispose();
  await dark?.dispose();
});

test("a light-only screen keeps light frames and says so", async ({ page }) => {
  // The device frames' fallback label stays on the one-frame stage below the
  // layout breakpoint; a light-only screen's canvas shows its Light row alone.
  await page.setViewportSize(NARROW_WINDOW);
  await page.goto(WELCOME);
  await chooseScheme(page, "dark");
  await page.goto("/view/design/browse/views/home/");
  await expect(page.locator("#mb-main h2")).toHaveText("Home");

  await expectFrameSource(
    page.locator(mobileFrame),
    /design\/browse\/views\/home\/index\.mobile\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /design\/browse\/views\/home\/index\.desktop\.html$/,
  );
  await expect(page.locator(".mbk-frame-mobile")).toHaveAttribute(
    "data-color-scheme-fallback",
    "",
  );
  const note = page.locator(".mbk-frame-mobile .mbk-frame-scheme-note");
  await expect(note).toBeVisible();
  await expect(note).toHaveText("— Light only");
  expect(
    await computedStyle(
      page,
      ".mbk-frame-mobile .mbk-frame-label",
      "textTransform",
    ),
  ).toBe("uppercase");
  await expect(
    page.locator(".mbk-frame-desktop .mbk-frame-scheme-note"),
  ).toBeVisible();
  expect(
    await overlayStyle(page, ".mbk-frame-mobile .phone-screen", "boxShadow"),
  ).toBe("none");

  await chooseScheme(page, "light");
  await expect(note).toBeHidden();
});

test("use-case steps follow the selected scheme without a caption", async ({
  page,
}) => {
  await page.goto(WELCOME);
  await chooseScheme(page, "dark");
  await page.fill("[data-mokly-search]", "tour");
  await page.click(tourRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Example tour");

  const steps = page.locator(".mbk-flow-screen iframe");
  await expect(steps).toHaveCount(2);
  await expectFrameSource(
    steps.nth(0),
    /example\/screens\/welcome\/index\.desktop\.dark\.html$/,
  );
  await expectFrameSource(
    steps.nth(1),
    /example\/screens\/details\/index\.desktop\.dark\.html$/,
  );
  await expect(page.locator(".mbk-flow-screen .mbk-frame-label")).toHaveCount(
    0,
  );
});
