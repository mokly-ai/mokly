import { expect, test, type Page } from "@playwright/test";

import { comparisonRegionsFixture } from "../helpers/comparison_regions_fixture.js";

import { loadComparison } from "./comparison_actions.js";
import { scrollTogether } from "./comparison_regions_helpers.js";
import { chooseViewport } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof comparisonRegionsFixture>>;
test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(120_000);
  fixture = await comparisonRegionsFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

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
  await page.goto(`${fixture.url}/view/shell/`);
  await chooseViewport(page, "desktop");
}

test("Current shows no switch; every diff mode shows it on, after the modes", async ({
  page,
}) => {
  await open(page, 1600);
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  await expect(scrollTogether(page)).toHaveCount(0);
  await expect(page.locator(".mbk-diff-sync")).toBeHidden();
  await loadComparison(page, "Side by side");
  for (const mode of ["Side by side", "Overlay", "Difference"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    const toggle = scrollTogether(page);
    await expect(toggle, mode).toBeVisible();
    await expect(toggle, mode).toBeChecked();
    await expect(toggle, mode).toHaveAttribute("type", "checkbox");
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
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(scrollTogether(page)).toHaveCount(0);
});

test("the switch is drawn as designed, on, off and focused", async ({
  page,
}) => {
  await open(page, 1600);
  await loadComparison(page, "Overlay");
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
  const off = await band(page);
  expect(off.track.background).toBe(off.tokens.bg);
  expect(off.track.border).toBe(off.tokens.edge);
  expect(off.track.knob.colour).toBe(off.tokens.edge);
  expect(off.track.knob.left).toBe("2px");
  expect(off.track.outline[0]).toBe("none");
  await page.getByRole("button", { name: "Difference", exact: true }).focus();
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
  await loadComparison(page, "Overlay");
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
}) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__mokly/diffs/review.json*", async (route) => {
    await held;
    await route.fulfill({ status: 500, body: "unavailable" });
  });
  await open(page, 1600);
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
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
