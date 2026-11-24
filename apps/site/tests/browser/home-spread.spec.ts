import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

/**
 * The home spread's compositions, in a real browser. A window that holds
 * the whole spread draws every artboard with the Components box beside the
 * Specs box. A narrower window first drops the right column of the Specs
 * box, the pricing desktop and the three phones under it, with Components
 * still beside Specs, and then folds Components under Specs. A phone draws
 * three phones with Components under them. Every composition keeps the
 * Components box inside the window. The parts are depictions with no role,
 * so the spec finds them by their classes.
 */

/** Runs a test in the desktop projects only. */
const DESKTOP = { tag: "@desktop" };

/** Runs a test in the mobile projects only. */
const MOBILE = { tag: "@mobile" };

/** The right column of the Specs box, which a narrower window drops. */
const ROOMY = [
  ".site-home-spread-pricing",
  ".site-home-spread-pricing-phone",
  ".site-home-spread-pricing-dark",
  ".site-home-spread-payment-dark",
  ".site-home-spread-claude",
] as const;

interface Box {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/** The rendered box of a part of the spread. */
async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (found === null) throw new Error("the part has no box");
  return found;
}

/** Opens the home at one window width, with the spread's motion settled. */
async function openAt(page: Page, width: number): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(SITE_PATHS.home);
}

/** The Specs and Components boxes of the spread. */
function boxes(page: Page): Record<"components" | "specs", Locator> {
  const spread = page.locator(".site-home-spread");
  return {
    components: spread.locator(".site-home-spread-components"),
    specs: spread.locator(".site-home-spread-specs"),
  };
}

for (const { name, width, roomy, folded } of [
  {
    name: "a window that holds the whole spread",
    width: 1920,
    roomy: true,
    folded: false,
  },
  { name: "a narrower window", width: 1440, roomy: false, folded: false },
  { name: "a narrow desktop window", width: 1000, roomy: false, folded: true },
]) {
  test(
    `${name} draws its composition of the spread`,
    DESKTOP,
    async ({ page }) => {
      await openAt(page, width);
      const spread = page.locator(".site-home-spread");
      for (const part of ROOMY) {
        if (roomy) await expect(spread.locator(part), part).toBeVisible();
        else await expect(spread.locator(part), part).toBeHidden();
      }
      const { components, specs } = boxes(page);
      const specsBox = await box(specs);
      const componentsBox = await box(components);
      if (folded) {
        expect(componentsBox.y).toBeGreaterThan(specsBox.y + specsBox.height);
      } else {
        expect(componentsBox.x).toBeGreaterThan(specsBox.x + specsBox.width);
        expect(componentsBox.y).toBe(specsBox.y);
      }
      expect(componentsBox.x + componentsBox.width).toBeLessThanOrEqual(width);
    },
  );
}

test(
  "a phone draws the Components box under the three phones",
  MOBILE,
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(SITE_PATHS.home);
    const { components } = boxes(page);
    const phones = page.locator(".site-home-spread .site-home-board");
    await expect(phones).toHaveCount(8);
    await expect(phones.filter({ visible: true })).toHaveCount(3);
    await expect(components).toBeVisible();
    const phone = await box(page.locator(".site-home-spread-payment"));
    const componentsBox = await box(components);
    const width = page.viewportSize()?.width ?? 0;
    expect(componentsBox.y).toBeGreaterThan(phone.y + phone.height);
    expect(componentsBox.x).toBeGreaterThanOrEqual(0);
    expect(componentsBox.x + componentsBox.width).toBeLessThanOrEqual(width);
  },
);
