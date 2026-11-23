/**
 * The canvas selection under the selection canvas contract: in Inspect a
 * click selects the innermost instance, which the canvas outlines with its
 * handles and tags; Escape, also from inside a frame, and the empty canvas
 * clear it; the tags on a frame hide while the canvas draws its frames at
 * less than 60% of their size; a variant set's frame label selects its
 * frame; and the compact layout's pill names the selection.
 */

import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  canvasFrame,
  openInspectFold,
  setFrames,
  viewportFrame,
  zoomToTags,
} from "./workspace_actions.js";

const WELCOME = "/view/example/screens/welcome/";

/** The canvas's drawing of the selected Toolbar, by its accessible name. */
const toolbar = (page: Page) =>
  page.getByRole("img", { name: /^Toolbar selected, \d+ by \d+$/u });

/** Inspect's Selection section. */
const selection = (page: Page) =>
  page.locator('[data-inspect-section="selection"]');

/** Open Welcome on the wide canvas, with each frame's document ready. */
async function openWelcome(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(WELCOME);
  await expect(
    page.locator(
      'iframe[data-workspace-frame][data-mokly-frame-state="ready"]',
    ),
  ).toHaveCount(4);
}

/** Click the Toolbar's title in a frame, which selects the Toolbar. */
async function clickToolbar(page: Page, frame = canvasFrame("mobile")) {
  await page.frameLocator(frame).getByText("Workspace actions").click();
}

/** A point of the canvas's stage that no frame and no control covers. */
async function emptyCanvasPoint(page: Page) {
  const stage = (await page.locator(".mbk-canvas-stage").boundingBox())!;
  const section = (await page.locator(".mbk-canvas-section").boundingBox())!;
  if (section.x - stage.x > 16)
    return { x: stage.x + 8, y: stage.y + stage.height / 2 };
  return { x: stage.x + stage.width / 2, y: stage.y + 8 };
}

test("a click in Inspect selects the innermost instance, and Escape or the empty canvas clears it", async ({
  page,
}) => {
  await openWelcome(page);
  await clickToolbar(page);
  await expect(toolbar(page)).toBeVisible();
  // The tags show where the canvas draws its frames at 60% or more; the
  // selection follows its frame through the zoom.
  await zoomToTags(page);
  await expect(
    toolbar(page).locator(".mbk-canvas-selection-handle"),
  ).toHaveCount(8);
  await expect(toolbar(page).locator(".mbk-canvas-selection-name")).toHaveText(
    "Toolbar",
  );
  await expect(toolbar(page).locator(".mbk-canvas-selection-size")).toHaveText(
    /^\d+ × \d+$/u,
  );
  // The frame that holds the selection lights its label, and Inspect names
  // the instance.
  await expect(page.locator(".mbk-canvas-frame[data-selected]")).toHaveCount(1);
  await expect(
    page
      .locator(".mbk-canvas-frame[data-selected]")
      .locator(canvasFrame("mobile")),
  ).toHaveCount(1);
  await expect(
    selection(page).getByRole("link", { name: "Toolbar", exact: true }),
  ).toBeVisible();

  // Escape acts while focus is in the shell.
  await page.getByRole("tab", { name: "Inspect", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("img", { name: /selected, / })).toHaveCount(0);
  await expect(selection(page)).toContainText(
    "Click an element on a frame to see its props.",
  );

  await page.keyboard.press("Shift+Digit1");
  await clickToolbar(page);
  await expect(toolbar(page)).toBeVisible();
  const point = await emptyCanvasPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole("img", { name: /selected, / })).toHaveCount(0);
});

test("Escape pressed inside a frame clears the selection that a click in it made", async ({
  page,
}) => {
  await openWelcome(page);
  await clickToolbar(page);
  await expect(toolbar(page)).toBeVisible();
  // The click gave the frame's document focus, so the frame hears Escape.
  await expect(page.locator(canvasFrame("mobile"))).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("img", { name: /selected, / })).toHaveCount(0);
  await expect(selection(page)).toContainText(
    "Click an element on a frame to see its props.",
  );
});

test("a click that follows a link selects nothing", async ({ page }) => {
  await openWelcome(page);
  // A modified click on the Action's link opens the details screen in a new
  // context, and the shell stays where it is.
  const opened = page.context().waitForEvent("page");
  await page
    .frameLocator(canvasFrame("mobile"))
    .getByText("View details")
    .click({ modifiers: ["ControlOrMeta"] });
  await (await opened).close();
  await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/u);
  await expect(page.getByRole("img", { name: /selected, / })).toHaveCount(0);
  await expect(selection(page)).toContainText(
    "Click an element on a frame to see its props.",
  );
});

test("the tags on a frame hide while the canvas draws its frames at less than 60% of their size", async ({
  page,
}) => {
  await openWelcome(page);
  const zoom = page
    .getByRole("group", { name: "Zoom" })
    .locator(".mbk-zoom-value");
  expect(Number.parseInt((await zoom.textContent())!, 10)).toBeLessThan(60);
  await page
    .getByRole("switch", { name: "Highlight components", exact: true })
    .check();
  // The masks draw at every zoom; the labels and the selection's tags wait.
  await expect(page.locator(".mbk-highlight-layer").first()).toBeVisible();
  await expect(page.locator(".mbk-highlight-label")).toHaveCount(0);
  await clickToolbar(page);
  await expect(toolbar(page)).toBeVisible();
  await expect(
    toolbar(page).locator(".mbk-canvas-selection-handle").first(),
  ).toBeVisible();
  await expect(
    toolbar(page).locator(".mbk-canvas-selection-name"),
  ).toBeHidden();
  await expect(
    toolbar(page).locator(".mbk-canvas-selection-size"),
  ).toBeHidden();

  await zoomToTags(page);
  await expect(page.locator(".mbk-highlight-label").first()).toBeVisible();
  await expect(
    toolbar(page).locator(".mbk-canvas-selection-name"),
  ).toBeVisible();
  await expect(
    toolbar(page).locator(".mbk-canvas-selection-size"),
  ).toBeVisible();
});

test("a change of the Frames filter refits the canvas", async ({ page }) => {
  await openWelcome(page);
  const zoom = async () =>
    Number.parseInt(
      (await page
        .getByRole("group", { name: "Zoom" })
        .locator(".mbk-zoom-value")
        .textContent())!,
      10,
    );
  const both = await zoom();
  await setFrames(page, { dark: false, light: true });
  // The Light row alone fits at a larger zoom.
  await expect.poll(zoom).toBeGreaterThan(both);
  await expect(page.locator(canvasFrame("desktop", "dark"))).toBeHidden();
  await setFrames(page, { dark: true });
  await expect.poll(zoom).toBe(both);
});

test("a variant set's frame label selects its frame, whose row Props edits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/view/example/components/action/");
  const props = await openInspectFold(page, "props");
  await expect(props).toContainText("Choose a variant to edit its props.");
  await page
    .getByRole("button", { name: "Disabled · Light", exact: true })
    .click();
  const frame = page.getByRole("img", {
    name: /^Disabled · Light selected, \d+ by \d+$/u,
  });
  await expect(frame).toBeVisible();
  await expect(frame.locator(".mbk-canvas-selection-handle")).toHaveCount(4);
  await expect(
    page.locator('[data-inspect-section="variants"] [data-checked]'),
  ).toHaveText("Disabled");
  await expect(selection(page)).toContainText("Frame");
  await expect(props).not.toContainText("Choose a variant to edit its props.");
});

test("the compact layout's pill names the selected instance and opens the panel's sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(WELCOME);
  const frame = viewportFrame("mobile");
  await expect(page.locator(frame)).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  await clickToolbar(page, frame);
  const pill = page.locator("[data-selection-pill]");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("Toolbar");
  await pill.click();
  await expect(
    page.getByRole("region", { name: "Panel", exact: true }),
  ).toBeVisible();
  await expect(
    selection(page).getByRole("link", { name: "Toolbar", exact: true }),
  ).toBeVisible();
  // The pill stands above the dock, which hides while a sheet is open.
  await expect(pill).toBeHidden();
});
