import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { paletteColor } from "../helpers/design_palette.js";
import { repositoryRoot } from "../helpers/fixture.js";

type Scheme = "dark" | "light";
type Viewport = "desktop" | "mobile";
type Box = { bottom: number; left: number; right: number; top: number };

/**
 * Diff-mode designs from every family: route, whether Scroll together is on,
 * and whether the design also renders in Dark.
 */
const DIFF_MODES = [
  ["design-changes-overlay", true, true],
  ["design-changes-overlay-long", true, true],
  ["design-changes-overlay-panel", true, true],
  ["design-changes-side-by-side-apart", false, true],
  ["design-review-changed", true, true],
  ["design-review-difference", true, true],
  ["design-review-style-matched", true, false],
  ["design-appearance-side-by-side", true, true],
  ["design-appearance-difference", true, true],
  ["design-component-comparison", true, false],
  ["design-component-overlay-tall", true, false],
  ["design-component-removed", true, false],
  ["design-ui-comparison-toolbar-overlay", true, false],
  ["design-ui-comparison-toolbar-side-by-side-apart", false, false],
] as const;

/** Bands showing Current, where one version has nothing to scroll with. */
const CURRENT = [
  "design-changes-current",
  "design-component-affected",
  "design-ui-comparison-toolbar-current",
  "design-ui-screen-header-changed",
];

async function open(
  page: Page,
  route: string,
  viewport: Viewport,
  scheme: Scheme = "light",
): Promise<void> {
  await page.setViewportSize(
    viewport === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  );
  const kind = route.startsWith("design-ui-") ? "components" : "screens";
  const file = `${kind}/${route}.${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
  await page.goto(
    pathToFileURL(
      path.join(repositoryRoot, "examples/basic/mokly-generated", file),
    ).href,
  );
  await expect(page.locator(".mbk-cmp-toolbar"), file).toHaveCount(1);
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

/** Reading order: on the same row further along, or on a later row. */
function follows(later: Box, earlier: Box): boolean {
  return later.top >= earlier.bottom || later.left >= earlier.right;
}

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: Scroll together follows the modes in every diff mode`, async ({
    page,
  }) => {
    for (const [route, on, dual] of DIFF_MODES) {
      const schemes: readonly Scheme[] = dual ? ["light", "dark"] : ["light"];
      for (const scheme of schemes) {
        const where = `${route} ${viewport} ${scheme}`;
        await open(page, route, viewport, scheme);
        const toggle = page.getByRole("switch", { name: "Scroll together" });
        await expect(toggle, where).toHaveCount(1);
        await expect(toggle, where).toBeVisible();
        await expect(toggle, where).toHaveAttribute("type", "checkbox");
        if (on) await expect(toggle, where).toBeChecked();
        else await expect(toggle, where).not.toBeChecked();
        const facts = await page
          .locator(".mbk-cmp-toolbar")
          .evaluate((toolbar) => {
            const box = (element: Element) => {
              const rect = element.getBoundingClientRect();
              return {
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                top: rect.top,
              };
            };
            const style = getComputedStyle(toolbar);
            const control = toolbar.querySelector(".mbk-cmp-sync")!;
            return {
              control: box(control),
              label: control.textContent,
              left:
                toolbar.getBoundingClientRect().left +
                parseFloat(style.paddingLeft),
              modes: box(toolbar.querySelector(".mbk-seg")!),
              order: [...toolbar.children].map((child) => child.className),
              refresh: box(toolbar.querySelector(".mbk-cmp-refresh")!),
              right:
                toolbar.getBoundingClientRect().right -
                parseFloat(style.paddingRight),
              track: getComputedStyle(
                control.querySelector(".mbk-cmp-sync-track")!,
              ).backgroundColor,
            };
          });
        expect(facts.order, where).toEqual([
          "mbk-seg",
          "mbk-cmp-sync",
          "mbk-cmp-refresh",
        ]);
        expect(facts.label, where).toBe("Scroll together");
        expect(facts.track, `${where}: the drawn state`).toBe(
          await paletteColor(scheme, on ? "--mbk-sage-deep" : "--chrome-bg"),
        );
        expect(follows(facts.control, facts.modes), where).toBe(true);
        expect(follows(facts.refresh, facts.control), where).toBe(true);
        expect(overlaps(facts.control, facts.modes), where).toBe(false);
        expect(overlaps(facts.control, facts.refresh), where).toBe(false);
        expect(facts.control.left, where).toBeGreaterThanOrEqual(facts.left);
        expect(facts.control.right, where).toBeLessThanOrEqual(facts.right);
        expect(
          Math.abs(facts.refresh.right - facts.right),
          `${where}: Refresh closes the band`,
        ).toBeLessThan(0.5);
        if (viewport === "mobile") {
          expect(
            [facts.modes.left - facts.left, facts.right - facts.modes.right],
            `${where}: the modes take the first row`,
          ).toEqual([0, 0]);
          expect(facts.control.top, where).toBeGreaterThanOrEqual(
            facts.modes.bottom,
          );
          expect(facts.control.left, `${where}: it starts the next row`).toBe(
            facts.left,
          );
        }
      }
    }
  });

  test(`${viewport}: Current draws no Scroll together`, async ({ page }) => {
    for (const route of CURRENT) {
      await open(page, route, viewport);
      await expect(
        page.getByRole("switch", { name: "Scroll together" }),
        route,
      ).toHaveCount(0);
      await expect(page.locator(".mbk-cmp-sync"), route).toHaveCount(0);
    }
  });

  test(`${viewport}: Scroll together switches in place without opening anything`, async ({
    page,
  }) => {
    await open(page, "design-changes-overlay-panel", viewport);
    const address = page.url();
    const toggle = page.getByRole("switch", { name: "Scroll together" });
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    await expect(toggle).toBeFocused();
    expect(page.url()).toBe(address);
  });
}
