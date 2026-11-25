import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { canvasColor } from "../helpers/design_palette.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { designFileUrl as servedDesignFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

/** Run the same assertions against each catalogue delivery. */
export function registerDesignScrollTogether() {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const designFileUrl = servedDesignFileUrl;
  type Scheme = "dark" | "light";
  type Viewport = "desktop" | "mobile";
  type Box = { bottom: number; left: number; right: number; top: number };

  /**
   * Diff-mode designs that draw the compare modes, in each viewport: route,
   * whether the design also renders in Dark, and whether Side by side names
   * its compared frame. A phone's Changes artboard in a comparison shows the
   * one frame, so the library samples stand for it.
   */
  const DIFF_MODES: Record<
    Viewport,
    readonly (readonly [string, boolean, boolean])[]
  > = {
    desktop: [
      ["design/canvas/changes/side-by-side", true, true],
      ["design/canvas/changes/overlay", true, false],
      ["design/canvas/changes/difference", true, false],
      ["design/canvas/changes/swipe", true, false],
      ["design/canvas/components/compare", true, false],
      ["design/canvas/outcomes/moved", true, false],
    ],
    mobile: [
      ["design/library/panels/compare-modes/side-by-side", false, true],
      ["design/library/panels/compare-modes/swipe", false, false],
    ],
  };

  /** Compare modes in Current, where one version has nothing to scroll with. */
  const CURRENT = [
    "design/canvas/changes/current",
    "design/canvas/outcomes/added/changes",
    "design/library/panels/compare-modes/current",
    "design/library/panels/compare-modes/added",
  ];

  /** The design that switches Scroll together in each viewport. */
  const SWITCHED: Record<Viewport, string> = {
    desktop: "design/canvas/changes/side-by-side",
    mobile: "design/library/panels/compare-modes/side-by-side",
  };

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
    const file = `${route}/index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
    await page.goto(
      designFileUrl(
        path.join(repositoryRoot, "examples/basic/mokly-generated", file),
      ).href,
    );
    await expect(page.locator(".cv-modes"), file).toHaveCount(1);
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
      for (const [route, dual, frames] of DIFF_MODES[viewport]) {
        const schemes: readonly Scheme[] = dual ? ["light", "dark"] : ["light"];
        for (const scheme of schemes) {
          const where = `${route} ${viewport} ${scheme}`;
          await open(page, route, viewport, scheme);
          const toggle = page.getByRole("switch", { name: "Scroll together" });
          await expect(toggle, where).toHaveCount(1);
          await expect(toggle, where).toBeVisible();
          await expect(toggle, where).toHaveAttribute("type", "checkbox");
          await expect(toggle, where).toBeChecked();
          const facts = await page.locator(".cv-modes").evaluate((modes) => {
            const box = (element: Element) => {
              const rect = element.getBoundingClientRect();
              return {
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                top: rect.top,
              };
            };
            const style = getComputedStyle(modes);
            const sync = modes.querySelector(":scope > .cv-mode-sync")!;
            const control = sync.querySelector(".cv-mode-switch")!;
            return {
              control: box(control),
              label: control.textContent,
              left:
                modes.getBoundingClientRect().left +
                parseFloat(style.paddingLeft),
              order: [...modes.children].map((child) => child.className),
              preceding: [...modes.children]
                .filter((child) => child !== sync)
                .map(box),
              refresh: box(sync.querySelector(".cv-mode-refresh")!),
              right:
                modes.getBoundingClientRect().right -
                parseFloat(style.paddingRight),
              sync: [...sync.children].map((child) => child.className),
              tiles: box(modes.querySelector(":scope > .cv-mode-tiles")!),
              track: getComputedStyle(
                control.querySelector(".cv-mode-switch-track")!,
              ).backgroundColor,
            };
          });
          expect(facts.order, where).toEqual(
            frames
              ? ["cv-mode-tiles", "cv-mode-frames", "cv-mode-sync"]
              : ["cv-mode-tiles", "cv-mode-sync"],
          );
          expect(facts.sync, where).toEqual([
            "cv-mode-switch",
            "cv-mode-refresh",
          ]);
          expect(facts.label, where).toBe("Scroll together");
          expect(facts.track, `${where}: the drawn state`).toBe(
            await canvasColor(scheme, "--cv-signal-deep"),
          );
          for (const earlier of facts.preceding) {
            expect(follows(facts.control, earlier), where).toBe(true);
            expect(overlaps(facts.control, earlier), where).toBe(false);
          }
          expect(follows(facts.refresh, facts.control), where).toBe(true);
          expect(overlaps(facts.control, facts.refresh), where).toBe(false);
          expect(facts.control.left, where).toBeGreaterThanOrEqual(facts.left);
          expect(facts.control.right, where).toBeLessThanOrEqual(facts.right);
          expect(
            Math.abs(facts.refresh.right - facts.right),
            `${where}: Refresh closes the row`,
          ).toBeLessThan(0.5);
          expect(
            [facts.tiles.left - facts.left, facts.right - facts.tiles.right],
            `${where}: the modes take the first row`,
          ).toEqual([0, 0]);
          expect(facts.control.top, where).toBeGreaterThanOrEqual(
            facts.tiles.bottom,
          );
          expect(facts.control.left, `${where}: it starts the next row`).toBe(
            facts.left,
          );
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
        await expect(page.locator(".cv-mode-sync"), route).toHaveCount(0);
      }
    });

    test(`${viewport}: Scroll together switches in place without opening anything`, async ({
      page,
    }) => {
      await open(page, SWITCHED[viewport], viewport);
      const address = page.url();
      const toggle = page.getByRole("switch", { name: "Scroll together" });
      await toggle.click();
      await expect(toggle).not.toBeChecked();
      await expect(page.locator(".cv-mode-switch-track")).toHaveCSS(
        "background-color",
        await canvasColor("light", "--cv-surface"),
      );
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toBeChecked();
      await expect(toggle).toBeFocused();
      expect(page.url()).toBe(address);
    });
  }
}
