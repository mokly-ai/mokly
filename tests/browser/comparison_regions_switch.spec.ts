import { expect, type Page } from "@playwright/test";

import { scrollTogether } from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton } from "./comparison_ui.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseViewport } from "./workspace_actions.js";

/** Every pane document of a comparison generation, without subresources. */
const DOCUMENTS = "**/mokly-viewer/diffs/generations/*/snapshots/**/*.html";

type Box = { bottom: number; left: number; right: number; top: number };

/** Geometry and drawn state of the comparison band's controls. */
function band(page: Page) {
  return page.locator(".mbk-diff-toolbar").evaluate((toolbar) => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    };
    const style = getComputedStyle(toolbar);
    const control = toolbar.querySelector(".mbk-diff-sync")!;
    const track = control.querySelector(".mbk-diff-sync-track")!;
    const knob = getComputedStyle(track, "::after");
    const token = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${name})`;
      toolbar.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    };
    return {
      content: {
        left:
          toolbar.getBoundingClientRect().left + parseFloat(style.paddingLeft),
        right:
          toolbar.getBoundingClientRect().right -
          parseFloat(style.paddingRight),
      },
      control: box(control),
      label: control.textContent,
      modes: box(toolbar.querySelector(".mbk-seg")!),
      order: [...toolbar.children]
        .filter((child) => !(child as HTMLElement).hidden)
        .map((child) => child.className),
      refresh: box(toolbar.querySelector(".mbk-diff-refresh")!),
      tokens: {
        accent: token("--mbk-accent-deep"),
        bg: token("--chrome-bg"),
        edge: token("--chrome-control-edge"),
        ink: token("--chrome-ink-2"),
        onAccent: token("--_mokly-private-on-accent-deep"),
      },
      track: {
        background: getComputedStyle(track).backgroundColor,
        border: getComputedStyle(track).borderTopColor,
        height: track.getBoundingClientRect().height,
        knob: {
          colour:
            parseFloat(knob.borderTopWidth) > 0
              ? knob.borderTopColor
              : knob.backgroundColor,
          left: knob.left,
          size: [knob.width, knob.height],
          top: knob.top,
        },
        outline: [
          getComputedStyle(track).outlineStyle,
          getComputedStyle(track).outlineWidth,
          getComputedStyle(track).outlineColor,
          getComputedStyle(track).outlineOffset,
        ],
        width: track.getBoundingClientRect().width,
      },
      text: {
        colour: getComputedStyle(control).color,
        size: getComputedStyle(control).fontSize,
        weight: getComputedStyle(control).fontWeight,
      },
    };
  });
}

async function open(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseViewport(page, "desktop");
}

test("Current shows no switch; every diff mode shows it on, after the modes", async ({
  page,
}) => {
  await open(page, 1600);
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  await expect(scrollTogether(page)).toBeHidden();
  await expect(page.locator(".mbk-diff-sync")).toBeHidden();
  for (const mode of ["Side by side", "Overlay", "Difference"] as const) {
    await modeButton(page, mode).click();
    const toggle = scrollTogether(page);
    await expect(toggle, mode).toBeVisible();
    await expect(toggle, mode).toBeChecked();
    await expect(toggle, mode).toHaveAttribute("type", "checkbox");
    await expect(page.locator(".mbk-diff-refresh")).toBeVisible();
    const facts = await band(page);
    expect(facts.order, mode).toEqual([
      "mbk-seg",
      "mbk-diff-sync",
      "mbk-diff-refresh",
    ]);
    expect(facts.label, mode).toBe("Scroll together");
    expect(facts.control.left - facts.modes.right, mode).toBeCloseTo(16, 1);
    expect(facts.control.top, mode).toBeLessThan(facts.modes.bottom);
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
  await modeButton(page, "Overlay").click();
  await expect(scrollTogether(page)).toBeChecked();
  const on = await band(page);
  expect(on.text).toEqual({
    colour: on.tokens.ink,
    size: "12px",
    weight: "600",
  });
  expect([on.track.width, on.track.height]).toEqual([30, 18]);
  expect(on.track.background).toBe(on.tokens.accent);
  expect(on.track.border).toBe(on.tokens.accent);
  expect(on.track.knob).toEqual({
    colour: on.tokens.onAccent,
    left: "14px",
    size: ["12px", "12px"],
    top: "2px",
  });
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  const off = await band(page);
  expect(off.track.background).toBe(off.tokens.bg);
  expect(off.track.border).toBe(off.tokens.edge);
  expect(off.track.knob.colour).toBe(off.tokens.edge);
  expect(off.track.knob.left).toBe("2px");
  expect(off.track.outline[0]).toBe("none");
  await modeButton(page, "Difference").focus();
  await page.keyboard.press("Tab");
  await expect(scrollTogether(page)).toBeFocused();
  const focused = await band(page);
  expect(focused.track.outline).toEqual([
    "solid",
    "2px",
    focused.tokens.accent,
    "2px",
  ]);
  await page.keyboard.press("Space");
  await expect(scrollTogether(page)).toBeChecked();

  await page.emulateMedia({ forcedColors: "active" });
  const forcedOn = await band(page);
  expect(forcedOn.track.knob.colour).not.toBe(forcedOn.track.background);
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
  const forcedOff = await band(page);
  expect(forcedOff.track.knob.colour).not.toBe(forcedOff.track.background);
  expect([forcedOn.track.knob.left, forcedOff.track.knob.left]).toEqual([
    "14px",
    "2px",
  ]);
});

test("a narrow band gives the modes the first row and the switch the second", async ({
  page,
}) => {
  await open(page, 800);
  await modeButton(page, "Overlay").click();
  await expect(page.locator(".mbk-diff-refresh")).toBeVisible();
  const facts = await band(page);
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
  for (const side of ["before", "after"])
    allowBrowserError(
      responseFailure(
        baseURL!,
        `/${index.comparisonUrl}snapshots/${side}/mokly-generated/${comparisonPaths.changed}/index.desktop.html`,
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
  await modeButton(page, "Overlay").click();
  const stage = page.locator("[data-diff-stage]");
  await expect(stage).toContainText("Loading comparison");
  await expect(scrollTogether(page)).toBeVisible();
  await expect(scrollTogether(page)).toBeChecked();
  release();
  await expect(stage).toContainText("The comparison could not be loaded.");
  await expect(scrollTogether(page)).toBeVisible();
  await scrollTogether(page).click();
  await expect(scrollTogether(page)).not.toBeChecked();
});
