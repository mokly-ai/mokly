import { expect, type Page } from "@playwright/test";

import { snapshotViewPath } from "../../packages/viewer/src/navigation/routes.js";

import { bandFacts, refreshButton } from "./comparison_band.js";
import { scrollTogether } from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseMode,
  compareState,
  comparisonIndex,
  modeButton,
} from "./comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseViewport, openPanelTab } from "./workspace_actions.js";

/** Every pane document of a comparison generation, without subresources. */
const DOCUMENTS = "**/mokly-viewer/diffs/generations/*/snapshots/**/*.html";

async function open(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
}

test("Current shows no switch; every diff mode shows it on, after the modes", async ({
  page,
}) => {
  await open(page, 1600);
  await openPanelTab(page, "Changes");
  await expect(modeButton(page, "Current")).toBeVisible();
  await expect(scrollTogether(page)).toBeHidden();
  await expect(
    page.locator("label:has([data-diff-scroll-together])"),
  ).toBeHidden();
  for (const mode of [
    "Side by side",
    "Overlay",
    "Difference",
    "Swipe",
  ] as const) {
    await modeButton(page, mode).click();
    const toggle = scrollTogether(page);
    await expect(toggle, mode).toBeVisible();
    await expect(toggle, mode).toBeChecked();
    await expect(toggle, mode).toHaveAttribute("type", "checkbox");
    await expect(refreshButton(page)).toBeVisible();
    const facts = await bandFacts(page);
    expect(facts.order, mode).toEqual(["modes", "switch", "refresh"]);
    expect(facts.label, mode).toBe("Scroll together");
    // In the right panel the modes take the band's width, so the switch
    // starts the next line at the band's content edge, and Refresh ends it.
    expect(facts.control.left - facts.content.left, mode).toBeCloseTo(0, 1);
    expect(facts.control.top, mode).toBeGreaterThanOrEqual(facts.modes.bottom);
    expect(Math.abs(facts.refresh.right - facts.content.right)).toBeLessThan(
      0.5,
    );
  }
  await modeButton(page, "Current").click();
  await expect(scrollTogether(page)).toBeHidden();
});

test("the switch is drawn as designed, on, off and focused", async ({
  page,
}) => {
  await open(page, 1600);
  await chooseMode(page, "Overlay");
  await expect(scrollTogether(page)).toBeChecked();
  const on = await bandFacts(page);
  expect(on.text).toEqual({
    colour: on.tokens.ink,
    size: "12.5px",
    weight: "400",
  });
  expect([on.track.width, on.track.height]).toEqual([32, 18]);
  expect(on.track.background).toBe(on.tokens.accent);
  expect(on.track.border).toBe(on.tokens.accent);
  expect(on.track.knob).toEqual({
    colour: on.tokens.onAccent,
    left: "16px",
    size: ["12px", "12px"],
    top: "2px",
  });
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  const off = await bandFacts(page);
  expect(off.track.background).toBe(off.tokens.surface);
  expect(off.track.border).toBe(off.tokens.edge);
  expect(off.track.knob.colour).toBe(off.tokens.edge);
  expect(off.track.knob.left).toBe("2px");
  expect(off.track.outline[0]).toBe("none");
  expect(off.track.shadow).toBe("none");
  // Swipe is the last mode, so Tab from it reaches the switch.
  await modeButton(page, "Swipe").focus();
  await page.keyboard.press("Tab");
  await expect(scrollTogether(page)).toBeFocused();
  // The track draws the focus glow of the switch over it.
  const focused = await bandFacts(page);
  expect(focused.track.outline[0]).toBe("none");
  expect(focused.track.shadow).toBe(focused.tokens.glow);
  // A mode draws the inset glow, and the shown mode keeps its raised shadow
  // under the glow.
  await page.keyboard.press("Shift+Tab");
  await expect(modeButton(page, "Swipe")).toBeFocused();
  await expect(modeButton(page, "Swipe")).toHaveCSS(
    "box-shadow",
    focused.tokens.glowInset,
  );
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(modeButton(page, "Overlay")).toBeFocused();
  const shown = await modeButton(page, "Overlay").evaluate(
    (button) => getComputedStyle(button).boxShadow,
  );
  expect(shown.startsWith(`${focused.tokens.glowInset}, `)).toBe(true);
  // Tab passes Difference and Swipe to reach the switch.
  for (let tabs = 0; tabs < 3; tabs += 1) await page.keyboard.press("Tab");
  await expect(scrollTogether(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(scrollTogether(page)).toBeChecked();

  // Forced colours drop the glow, so the focused track takes the system
  // outline.
  await page.emulateMedia({ forcedColors: "active" });
  const forcedOn = await bandFacts(page);
  expect(forcedOn.track.outline.slice(0, 2)).toEqual(["solid", "2px"]);
  expect(forcedOn.track.knob.colour).not.toBe(forcedOn.track.background);
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  const forcedOff = await bandFacts(page);
  expect(forcedOff.track.knob.colour).not.toBe(forcedOff.track.background);
  expect([forcedOn.track.knob.left, forcedOff.track.knob.left]).toEqual([
    "16px",
    "2px",
  ]);
});

test("a narrow band gives the modes the first row and the switch the second", async ({
  page,
}) => {
  await open(page, 800);
  await chooseMode(page, "Overlay");
  await expect(refreshButton(page)).toBeVisible();
  const facts = await bandFacts(page);
  expect([
    facts.modes.left - facts.content.left,
    facts.content.right - facts.modes.right,
  ]).toEqual([0, 0]);
  expect(facts.control.top).toBeGreaterThanOrEqual(facts.modes.bottom);
  expect(facts.control.left).toBe(facts.content.left);
  expect(facts.refresh.top).toBeGreaterThanOrEqual(facts.modes.bottom);
  expect(Math.abs(facts.refresh.right - facts.content.right)).toBeLessThan(0.5);
});

test("the switch stays while a comparison loads and after it fails", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  // The compare loads the documents of the Light and the Dark frame.
  for (const side of ["before", "after"] as const)
    for (const scheme of ["light", "dark"] as const)
      allowBrowserError(
        responseFailure(
          baseURL!,
          `/${index.comparisonUrl}${snapshotViewPath(side, comparisonPaths.changed, "desktop", scheme)}`,
          500,
        ),
      );
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(DOCUMENTS, async (route) => {
    await held;
    await route.fulfill({ status: 500, body: "unavailable" });
  });
  await open(page, 1600);
  await chooseMode(page, "Overlay");
  const state = compareState(page);
  await expect(state).toContainText("Loading comparison");
  await expect(scrollTogether(page)).toBeVisible();
  await expect(scrollTogether(page)).toBeChecked();
  release();
  await expect(state).toContainText("The comparison could not be loaded.");
  await expect(scrollTogether(page)).toBeVisible();
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
});
