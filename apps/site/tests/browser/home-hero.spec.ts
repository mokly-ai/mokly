import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

/**
 * The home hero's selected heading layer and the spread under it, in a real
 * browser: the layer's size tag, type badge and redline show the rendered
 * values of docs/protocol/cloud/site-design-pages.md and follow the layout,
 * the heading takes one line on the desktop and two on a phone, the spread
 * stays out of the accessibility tree and the focus order, no two of its
 * component sets meet, and without
 * script no measured value shows. The load motion moves only decorations,
 * and reduced motion shows the finished hero at once. The measured parts are
 * depictions with no role, so the spec finds them by their classes.
 */

/** Runs a test in the desktop projects only. */
const DESKTOP = { tag: "@desktop" };

/** Runs a test in the mobile projects only. */
const MOBILE = { tag: "@mobile" };

/** The heading of the hero, which the layer selects. */
function heading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

/** The measured parts of the heading layer. */
function layer(page: Page): Record<"badge" | "gap" | "size", Locator> {
  const selection = page.locator(".site-home-title-sel");
  return {
    badge: selection.locator(".site-sel-badge"),
    gap: page.locator(".site-home-hero-redline .site-redline-value"),
    size: selection.locator(".site-sel-size"),
  };
}

/** The spread of the depicted demo app under the hero. */
function spread(page: Page): Locator {
  return page.locator(".site-home-spread");
}

/**
 * Opens the home once its fonts have loaded, so the heading has its final
 * box. The fonts' readiness is a state the page reports only to script.
 */
async function openHome(page: Page): Promise<void> {
  await page.goto(SITE_PATHS.home);
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

/** The size that a tag of the heading must read: its box, rounded. */
async function renderedSize(page: Page): Promise<string> {
  const box = await heading(page).boundingBox();
  if (box === null) throw new Error("the heading has no box");
  return `${Math.round(box.width)} × ${Math.round(box.height)}`;
}

/**
 * The number of lines that the heading's text takes. Playwright counts no
 * lines, so the spec reads the line boxes of the heading's text.
 */
async function lines(page: Page): Promise<number> {
  return heading(page).evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const tops = [...range.getClientRects()].map((rect) => rect.top);
    return new Set(tops.map(Math.round)).size;
  });
}

test(
  "the heading layer reads its rendered size, its type and its gap to the lead",
  DESKTOP,
  async ({ page }) => {
    await openHome(page);
    const { badge, gap, size } = layer(page);
    await expect.poll(() => lines(page)).toBe(1);
    await expect(size).toHaveText(await renderedSize(page));
    await expect(badge).toHaveText("Geist Semibold 162");
    await expect(gap).toHaveText("60");
  },
);

test(
  "the heading layer's size tag follows a window resize",
  DESKTOP,
  async ({ page }) => {
    await openHome(page);
    const { size } = layer(page);
    const wide = await renderedSize(page);
    await expect(size).toHaveText(wide);
    await page.setViewportSize({ width: 1200, height: 900 });
    const narrower = await renderedSize(page);
    expect(narrower).not.toBe(wide);
    await expect(size).toHaveText(narrower);
  },
);

test(
  "a phone sets the heading on two lines, with its gap and no type badge",
  MOBILE,
  async ({ page }) => {
    await openHome(page);
    const { badge, gap } = layer(page);
    await expect.poll(() => lines(page)).toBe(2);
    await expect(gap).toHaveText("52");
    await expect(badge).toHaveCount(1);
    await expect(badge).toBeHidden();
  },
);

test(
  "the spread is hidden from assistive technology and takes no focus",
  DESKTOP,
  async ({ page }) => {
    await openHome(page);
    await expect(spread(page)).toBeVisible();
    await expect(spread(page)).toHaveAttribute("aria-hidden", "true");
    // The spread follows the hero's last action, so the next Tab skips it.
    const download = page
      .getByRole("main")
      .getByRole("link", { name: "Download for Mac" });
    await download.focus();
    await page.keyboard.press("Tab");
    await expect(download).not.toBeFocused();
    await expect(spread(page).locator(":focus")).toHaveCount(0);
  },
);

test(
  "on load the heading and the lead never start hidden",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    // Read once at load, while the decorations still move: motion has no
    // other handle. No animation holds the heading, the lead or a box around
    // either of them.
    const holding = await page.locator("#hero").evaluate((hero) => {
      const parts = [
        hero.querySelector("h1"),
        hero.querySelector(".site-hero-lead"),
      ];
      return hero.getAnimations({ subtree: true }).filter((animation) => {
        const target =
          animation.effect instanceof KeyframeEffect
            ? animation.effect.target
            : null;
        return parts.some((part) => part !== null && target?.contains(part));
      }).length;
    });
    expect(holding).toBe(0);
  },
);

test.describe("under reduced motion", DESKTOP, () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the hero shows its finished state at once", async ({ page }) => {
    await openHome(page);
    const moving = await page
      .locator("#hero")
      .evaluate((hero) => hero.getAnimations({ subtree: true }).length);
    expect(moving).toBe(0);
  });

  test("no two component sets of the spread meet", async ({ page }) => {
    // The Components box bleeds off the right edge at 1440px; a wider
    // window shows all six sets.
    await page.setViewportSize({ height: 900, width: 1920 });
    await openHome(page);
    const meeting = await spread(page).evaluate((root) => {
      // What the reader sees of a set: its label, its box with the dashed
      // outline around it, and a selection over it.
      const OUTLINE = 4;
      const extents = [...root.querySelectorAll(".site-home-set")].map(
        (set) => {
          const parts = [
            ...set.querySelectorAll(
              ".site-home-set-label, .site-home-set-peer",
            ),
          ].map((part) => part.getBoundingClientRect());
          const box = set
            .querySelector(".site-home-set-box")
            ?.getBoundingClientRect();
          if (box !== undefined)
            parts.push(
              new DOMRect(
                box.x - OUTLINE,
                box.y - OUTLINE,
                box.width + 2 * OUTLINE,
                box.height + 2 * OUTLINE,
              ),
            );
          return {
            bottom: Math.max(...parts.map((part) => part.bottom)),
            left: Math.min(...parts.map((part) => part.left)),
            name: set.querySelector(".site-home-set-label")?.textContent,
            right: Math.max(...parts.map((part) => part.right)),
            top: Math.min(...parts.map((part) => part.top)),
          };
        },
      );
      const pairs = extents.flatMap((a, index) =>
        extents
          .slice(index + 1)
          .filter(
            (b) =>
              a.left <= b.right &&
              b.left <= a.right &&
              a.top <= b.bottom &&
              b.top <= a.bottom,
          )
          .map((b) => `${a.name?.trim()} and ${b.name?.trim()}`),
      );
      return { count: extents.length, pairs };
    });
    expect(meeting).toEqual({ count: 6, pairs: [] });
  });
});

test.describe("without script", DESKTOP, () => {
  test.use({ javaScriptEnabled: false });

  test("the heading layer shows no measured size, type or gap", async ({
    page,
  }) => {
    await page.goto(SITE_PATHS.home);
    await expect(heading(page)).toBeVisible();
    for (const [name, part] of Object.entries(layer(page))) {
      await expect(part, name).toHaveCount(1);
      await expect(part, name).toBeHidden();
    }
  });
});
