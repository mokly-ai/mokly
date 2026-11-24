import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { useCaseStep, useCaseSteps } from "./use_case_steps.js";
import { canvasFrame } from "./workspace_actions.js";

test.use({ viewport: { width: 390, height: 844 } });

/** The box of a shown element, once it shows. */
async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

function dock(page: Page): Locator {
  return page.getByRole("group", { name: "Canvas controls" });
}

function picker(page: Page): Locator {
  return page.getByRole("combobox", { name: "Frame" });
}

/** The frames that the compact canvas shows. */
function shownFrames(page: Page): Locator {
  return page.locator(".mbk-canvas-cell:not([hidden]) iframe");
}

test("a screen shows its Mobile · Light frame alone, named with its slug, and the picker switches the frame", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const bar = page.locator("[data-entry-bar]");
  await expect(bar.locator(".mbk-canvas-title-tag")).toHaveText("Welcome");
  await expect(picker(page)).toHaveValue("mobile-light");
  await expect(picker(page).locator("option")).toHaveText([
    "Mobile · Light",
    "Mobile · Dark",
    "Desktop · Light",
    "Desktop · Dark",
  ]);
  await expect(shownFrames(page)).toHaveCount(1);
  await expect(page.locator(canvasFrame("mobile"))).toBeVisible();
  await expect(page.locator(".mbk-canvas-frame-name:visible")).toHaveText(
    "welcome · Mobile · Light",
  );
  await expect(page.getByRole("group", { name: "Zoom" })).toBeHidden();
  // The frame stands at the stage's top, large enough to read.
  const frame = await box(page.locator(canvasFrame("mobile")));
  expect(frame.width / 390).toBeGreaterThan(0.6);
  await picker(page).selectOption("desktop-dark");
  await expect(shownFrames(page)).toHaveCount(1);
  await expect(page.locator(canvasFrame("desktop", "dark"))).toBeVisible();
  await expect(page.locator(".mbk-canvas-frame-name:visible")).toHaveText(
    "welcome · Desktop · Dark",
  );
});

test("the dock holds Catalogue, Inspect and Fit as 44px targets, and Fit refits a panned frame", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const controls = dock(page).getByRole("button");
  await expect(controls).toHaveText(["Catalogue", "Inspect", ""]);
  await expect(dock(page).getByRole("button", { name: "Fit" })).toBeVisible();
  for (const control of await controls.all())
    expect((await box(control)).height).toBe(44);
  const frame = page.locator(canvasFrame("mobile"));
  const fitted = await box(frame);
  const canvas = await box(page.locator("[data-mokly-stage]"));
  await page.mouse.move(canvas.x + 8, canvas.y + 200);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 8 + 120, canvas.y + 260, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await box(frame)).x).not.toBe(fitted.x);
  await dock(page).getByRole("button", { name: "Fit" }).click();
  await expect.poll(async () => (await box(frame)).x).toBe(fitted.x);
  near((await box(frame)).y, fitted.y);
  // With nothing selected the dock holds Catalogue alone.
  await page.goto("/");
  await expect(dock(page).getByRole("button")).toHaveText(["Catalogue"]);
});

test("the catalogue and the panel open as sheets, one at a time, and the grabber expands a sheet", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const canvas = await box(page.locator("[data-mokly-stage]"));
  const catalogue = page.locator('[data-floating-panel="left"]');
  const panel = page.getByRole("region", { name: "Panel" });
  await expect(catalogue).toBeHidden();
  await expect(panel).toBeHidden();
  await dock(page).getByRole("button", { name: "Catalogue" }).click();
  await expect(
    page.getByRole("navigation", { name: "Catalogue" }),
  ).toBeVisible();
  await expect(dock(page)).toHaveCount(0);
  await expect(panel).toBeHidden();
  const sheet = await box(catalogue);
  near(sheet.width, 390);
  near(sheet.y + sheet.height, canvas.y + canvas.height);
  near(sheet.height, canvas.height * 0.64);
  await page.getByRole("button", { name: "Expand catalogue" }).click();
  await expect
    .poll(async () => Math.round((await box(catalogue)).height))
    .toBe(Math.round(canvas.height * 0.88));
  // A strip of the canvas stays visible above the expanded sheet.
  expect((await box(catalogue)).y).toBeGreaterThan(canvas.y + 60);
  await page.getByRole("button", { name: "Close catalogue" }).click();
  await expect(catalogue).toBeHidden();
  await expect(
    dock(page).getByRole("button", { name: "Catalogue" }),
  ).toBeFocused();

  await dock(page).getByRole("button", { name: "Inspect" }).click();
  await expect(
    panel.getByRole("heading", { name: "Welcome", exact: true }),
  ).toBeVisible();
  await expect(catalogue).toBeHidden();
  // The sheet opens at its compact height, whatever the last sheet's was.
  near((await box(panel)).height, canvas.height * 0.64);
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(panel).toBeHidden();
  await expect(
    dock(page).getByRole("button", { name: "Inspect" }),
  ).toBeFocused();
});

test("a variant set shows its whole set until a saved variant picks its frame", async ({
  page,
}) => {
  await page.goto("/view/example/components/action/");
  await expect(page.locator("[data-entry-bar]")).toContainText("Component");
  await expect(picker(page)).toHaveCount(0);
  await expect(shownFrames(page)).toHaveCount(8);
  await page.goto("/view/example/components/action/disabled/");
  await expect(picker(page)).toHaveValue(
    "example/components/action/disabled:light",
  );
  await expect(shownFrames(page)).toHaveCount(1);
  await expect(page.locator(".mbk-canvas-frame-name:visible")).toHaveText(
    "Disabled · Light",
  );
  await picker(page).selectOption({ label: "Secondary · Dark" });
  await expect(page).toHaveURL(
    /\/view\/example\/components\/action\/secondary\/$/,
  );
  await expect(picker(page)).toHaveValue(
    "example/components/action/secondary:dark",
  );
  await expect(page.locator(".mbk-canvas-frame-name:visible")).toHaveText(
    "Secondary · Dark",
  );
});

test("a use case opens on its first step, and the picker shows each step alone", async ({
  page,
}) => {
  await page.goto("/view/example/tour/");
  await expect(picker(page)).toHaveValue("step-0");
  await expect(picker(page).locator("option")).toHaveText([
    "1 · Welcome",
    "2 · Details",
  ]);
  // The hidden step stays mounted out of the section.
  await expect(page.locator("[data-mokly-stage] iframe")).toHaveCount(2);
  await expect(useCaseSteps(page)).toHaveCount(1);
  await expect(useCaseStep(page, 1).getByRole("link")).toHaveText("Welcome");
  await picker(page).selectOption({ label: "2 · Details" });
  await expect(picker(page)).toHaveValue("step-1");
  await expect(useCaseSteps(page)).toHaveCount(1);
  await expect(useCaseStep(page, 2).getByRole("link")).toHaveText("Details");
  // The step frame stands where the canvas fits it, from the stage's top.
  await dock(page).getByRole("button", { name: "Fit" }).click();
  await expect(useCaseStep(page, 2)).toBeInViewport();
});

test("a reading frame takes the canvas's width and has no picker", async ({
  page,
}) => {
  await page.goto("/view/example/workspace-guide/");
  const frame = page.locator(".mbk-canvas-frame[data-canvas-frame='document']");
  await expect(frame).toBeVisible();
  await expect(picker(page)).toHaveCount(0);
  await expect(page.locator("[data-entry-bar]")).toContainText(
    "Workspace guide",
  );
  near((await box(frame)).width, 390 - 32);
});
