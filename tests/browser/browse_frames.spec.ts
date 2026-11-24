import { expect } from "@playwright/test";

import {
  computedStyle,
  darkSurface,
  expectSchemeSelected,
  shellRoot,
  tourRow,
} from "./browse_assertions.js";
import { test } from "./browser_test.js";
import {
  useCaseStep,
  useCaseStepFrame,
  useCaseSteps,
} from "./use_case_steps.js";
import {
  canvasFrame,
  chooseScheme,
  chooseViewport,
  expectFrameSource,
  NARROW_WINDOW,
} from "./workspace_actions.js";

const WELCOME = "/view/example/screens/welcome/";

test("the Frames filter's viewport toggles keep one column of canvas frames", async ({
  page,
}) => {
  await page.goto(WELCOME);
  // The Frames filter in Inspect holds the viewport toggles, each on at a
  // full page load.
  const filter = page.getByRole("group", { name: "Frames" });
  await expect(filter).toBeVisible();
  for (const name of ["mobile", "desktop"])
    await expect(
      filter.locator(`[data-frames-toggle="${name}"]`),
    ).toBeChecked();
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

test("the compact layout's dark frame keeps its surface and edge", async ({
  page,
}) => {
  // Below the layout breakpoint one frame shows, in the preview scheme.
  await page.setViewportSize(NARROW_WINDOW);
  await page.goto(WELCOME);
  await chooseScheme(page, "dark");
  const frame = page.locator(canvasFrame("mobile", "dark"));
  await expect(frame).toBeVisible();
  const clip = ".mbk-canvas-cell:not([hidden]) .mbk-canvas-frame-clip";
  expect(await computedStyle(page, clip, "backgroundColor")).toBe(darkSurface);
  // The ring and the lift keep the frame's edge on the canvas.
  expect(await computedStyle(page, clip, "boxShadow")).toContain(
    "0px 0px 0px 1px",
  );
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

test("use-case steps keep the use case's own Light frames under Dark, each labelled by its step", async ({
  page,
}) => {
  await page.goto(WELCOME);
  await chooseScheme(page, "dark");
  await page.fill("[data-mokly-search]", "tour");
  await page.click(tourRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Example tour");

  await expect(useCaseSteps(page)).toHaveCount(2);
  await expectFrameSource(
    useCaseStepFrame(page, 1),
    /example\/screens\/welcome\/index\.desktop\.html$/,
  );
  await expectFrameSource(
    useCaseStepFrame(page, 2),
    /example\/screens\/details\/index\.desktop\.html$/,
  );
  for (const [step, title] of [
    [1, "Welcome"],
    [2, "Details"],
  ] as const)
    await expect(useCaseStep(page, step).getByRole("link")).toHaveText(title);
});
