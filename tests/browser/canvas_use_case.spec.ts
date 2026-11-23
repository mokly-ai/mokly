/**
 * A use case on the canvas, under the canvas stage contract's Use Case
 * section and the step frame of the canvas frames contract: one section of
 * step frames in one row at one zoom, each named by its step, with the
 * step's description below its label and a link that opens its screen.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { useCaseStep, useCaseSteps } from "./use_case_steps.js";

const TOUR = "/view/example/tour/";

/** The focus glow's ring: a 4px spread without blur, before any other shadow. */
const GLOW = /^(?:rgba?|color)\([^)]*\) 0px 0px 0px 4px(?:,|$)/u;

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

/** Press Tab until `target` holds the focus, as a keyboard reader moves it. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement))
      return;
  }
  throw new Error("The link was not reachable with Tab");
}

test("a use case opens as one row of step frames at one zoom, under a head that names it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(TOUR);
  const stage = page.locator("[data-mokly-stage]");
  await expect(useCaseSteps(page)).toHaveCount(2);
  // The head names the use case with its title and its path, and no kind.
  await expect(
    stage.getByRole("button", { name: "Copy path example/tour", exact: true }),
  ).toBeVisible();
  await expect(stage.getByText("Example tour", { exact: true })).toBeVisible();
  await expect(stage.getByText("Component", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Zoom" })).toBeVisible();
  // The steps stand in step order, left to right, at one zoom, fitted.
  const first = await box(useCaseStep(page, 1).locator("iframe"));
  const second = await box(useCaseStep(page, 2).locator("iframe"));
  expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
  expect(second.x).toBeGreaterThan(first.x + first.width);
  expect(first.width).toBeLessThan(1280);
  // Each label names its step, and the step's description stands between
  // the label and the frame.
  const step = useCaseStep(page, 1);
  await expect(step).toHaveAccessibleDescription(
    "A linked landing screen for the neutral fixture.",
  );
  const label = await box(step.locator("figcaption"));
  const description = await box(
    step.getByText("A linked landing screen for the neutral fixture."),
  );
  expect(label.y + label.height).toBeLessThanOrEqual(description.y);
  expect(description.y + description.height).toBeLessThanOrEqual(first.y);
  await expect(step.locator("figcaption")).toContainText("1280 × 800");
  // The step's link opens its screen.
  await useCaseStep(page, 2)
    .getByRole("link", { name: "Details, Details screen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/view\/example\/screens\/details\/$/u);
});

test("a step's link takes the focus glow, and Enter opens its screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(TOUR);
  const link = useCaseStep(page, 1).getByRole("link", {
    name: "Welcome, Welcome screen",
    exact: true,
  });
  await expect(link).toBeVisible();
  expect(
    await link.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toMatch(GLOW);
  await tabTo(page, link);
  await expect(link).toBeFocused();
  expect(
    await link.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toMatch(GLOW);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/u);
});
