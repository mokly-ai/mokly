import { expect, test } from "@playwright/test";

import {
  detailsRow,
  designHomeRow,
  tourRow,
  mobileFrame,
  desktopFrame,
  darkSurface,
  expectSchemeSelected,
  computedStyle,
  overlayStyle,
} from "./browse_assertions.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

test("viewport controls switch device frames", async ({ page }) => {
  await page.goto("/view/screens/example-welcome.html");
  await expect(
    page.locator(".mbk-screen-head [data-workspace-viewport]"),
  ).toBeVisible();
  await expect(page.locator(".mbk-viewbar")).toHaveCount(0);
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeVisible();
  await chooseViewport(page, "mobile");
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeHidden();
  await chooseViewport(page, "desktop");
  await expect(page.locator(".mbk-frame-mobile")).toBeHidden();
  await expect(page.locator(".mbk-frame-desktop")).toBeVisible();
});

test("color scheme switch swaps device frames", async ({ page }) => {
  await page.goto("/view/screens/example-welcome.html");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-welcome\.mobile\.html$/,
  );
  await expectSchemeSelected(page, "light");

  await chooseScheme(page, "dark");
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-welcome\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/example-welcome\.desktop\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await chooseScheme(page, "light");
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "light",
  );
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-welcome\.mobile\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/example-welcome\.desktop\.html$/,
  );
  await expectSchemeSelected(page, "light");
});

test("dark device screens keep their surface and edge", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1_280 });
  await page.goto("/view/screens/example-welcome.html");
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

test("view controls retain mounted screen frames and their selected sources", async ({
  page,
}) => {
  await page.goto("/view/screens/example-welcome.html");
  await chooseScheme(page, "dark");
  const mobile = await page.locator(mobileFrame).elementHandle();
  const desktop = await page.locator(desktopFrame).elementHandle();
  expect(mobile).not.toBeNull();
  expect(desktop).not.toBeNull();

  await chooseViewport(page, "mobile");
  expect(await mobile?.evaluate((node) => node.isConnected)).toBe(true);
  expect(await desktop?.evaluate((node) => node.isConnected)).toBe(true);
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-welcome\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/example-welcome\.desktop\.dark\.html$/,
  );

  await mobile?.dispose();
  await desktop?.dispose();
});

test("view controls retain mounted component frames", async ({ page }) => {
  await page.goto("/view/components/example-action.html");
  const mobileFrame = page.locator('[data-workspace-frame="mobile"]');
  const desktopFrame = page.locator('[data-workspace-frame="desktop"]');
  const mobile = await mobileFrame.elementHandle();
  const desktop = await desktopFrame.elementHandle();
  expect(mobile).not.toBeNull();
  expect(desktop).not.toBeNull();

  await chooseViewport(page, "mobile");
  expect(await mobile?.evaluate((node) => node.isConnected)).toBe(true);
  expect(await desktop?.evaluate((node) => node.isConnected)).toBe(true);

  await mobile?.dispose();
  await desktop?.dispose();
});

test("a light-only screen keeps light frames and says so", async ({ page }) => {
  await page.goto("/view/screens/example-welcome.html");
  await chooseScheme(page, "dark");
  await page.fill("[data-mokly-search]", "home");
  await page.click(designHomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");

  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/design-browse-home\.mobile\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/design-browse-home\.desktop\.html$/,
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
  await page.goto("/view/screens/example-welcome.html");
  await chooseScheme(page, "dark");
  await page.fill("[data-mokly-search]", "tour");
  await page.click(tourRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Example tour");

  const steps = page.locator(".mbk-flow-screen iframe");
  await expect(steps).toHaveCount(2);
  await expectFrameSource(
    steps.nth(0),
    /screens\/example-welcome\.desktop\.dark\.html$/,
  );
  await expectFrameSource(
    steps.nth(1),
    /screens\/example-details\.desktop\.dark\.html$/,
  );
  await expect(page.locator(".mbk-flow-screen .mbk-frame-label")).toHaveCount(
    0,
  );
});

test("scheme selection survives progressive navigation", async ({ page }) => {
  await page.goto("/view/screens/example-welcome.html");
  await chooseScheme(page, "dark");
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-details\.mobile\.dark\.html$/,
  );
  await expectFrameSource(
    page.locator(desktopFrame),
    /screens\/example-details\.desktop\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-welcome\.mobile\.dark\.html$/,
  );
  await expectSchemeSelected(page, "dark");

  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectFrameSource(
    page.locator(mobileFrame),
    /screens\/example-details\.mobile\.dark\.html$/,
  );
});
