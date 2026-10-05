import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { viewRoute } from "@mokly/viewer/data";

import { paletteColor } from "../helpers/design_palette.js";
import {
  NOTICE_COPY,
  PROGRESS_COPY,
  REBUILD_STATES,
  fragment,
} from "../helpers/design_rebuild_status.js";
import { repositoryRoot } from "../helpers/fixture.js";

const directory = path.join(repositoryRoot, "examples/basic/generated");
const SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

type Viewport = keyof typeof SIZES;

function state(id: string) {
  const found = REBUILD_STATES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`unknown rebuild state ${id}`);
  return found;
}

async function open(page: Page, route: string, viewport: Viewport) {
  await page.setViewportSize(SIZES[viewport]);
  await page.goto(pathToFileURL(path.join(directory, route)).href);
}

/** The geometry of every region progress must never move, keyed by region. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 10) / 10;
    const box = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const { x, y, width, height } = node.getBoundingClientRect();
      return {
        x: round(x),
        y: round(y),
        width: round(width),
        height: round(height),
      };
    };
    const main = document.querySelector(".mbk-main");
    return {
      topBar: box(".mbk-topbar"),
      menu: box(".mbk-menu-btn"),
      brand: box(".mbk-brand"),
      appearance: box(".mbk-appearance"),
      notice: box(".mbk-rebuild"),
      body: box(".mbk-body") ?? box(".mbk-main"),
      navigation: box(".mbk-nav"),
      stage: box(".mbk-stage"),
      scroll: [window.scrollX, window.scrollY, main?.scrollTop ?? 0],
    };
  });
}

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: showing progress moves nothing but the search field's end`, async ({
    page,
  }) => {
    for (const [before, after] of [
      [
        viewRoute("design/interactive/modes/static", viewport, "light"),
        fragment(state("design/rebuild-status/updating"), viewport),
      ],
      [
        fragment(state("design/rebuild-status/failure"), viewport),
        fragment(state("design/rebuild-status/failure-updating"), viewport),
      ],
    ] as const) {
      await open(page, before, viewport);
      const hidden = await geometry(page);
      const field = (await page.locator(".mbk-search").boundingBox())!;
      await open(page, after, viewport);
      expect(await geometry(page), after).toEqual(hidden);
      const narrowed = (await page.locator(".mbk-search").boundingBox())!;
      expect(narrowed.x).toBeCloseTo(field.x, 1);
      expect(narrowed.width).toBeLessThan(field.width);
      expect(narrowed.height, "the query stays on one line").toBe(30);
      const progress = page.locator(".mbk-progress");
      await expect(progress).toHaveText(PROGRESS_COPY);
      const slot = (await progress.boundingBox())!;
      const appearance = (await page.locator(".mbk-appearance").boundingBox())!;
      expect(slot.height).toBe(30);
      expect(slot.x).toBeGreaterThan(narrowed.x + narrowed.width);
      expect(slot.x + slot.width).toBeLessThan(appearance.x);
    }
  });

  test(`${viewport}: the notice spans the shell between the top bar and the body`, async ({
    page,
  }) => {
    for (const rebuild of REBUILD_STATES.filter(({ notice }) => notice)) {
      await open(page, fragment(rebuild, viewport), viewport);
      const { topBar, notice, body } = await geometry(page);
      if (!topBar || !notice || !body) throw new Error(`${rebuild.id} layout`);
      expect(notice.x).toBe(topBar.x);
      expect(notice.width).toBe(topBar.width);
      expect(notice.y).toBe(topBar.y + topBar.height);
      expect(body.y).toBe(notice.y + notice.height);
    }
  });

  test(`${viewport}: the disclosure works by keyboard and never moves`, async ({
    page,
  }) => {
    await open(
      page,
      fragment(state("design/rebuild-status/failure"), viewport),
      viewport,
    );
    const summary = page.locator(".mbk-rebuild-details > summary");
    for (let step = 0; step < 20; step += 1) {
      if (await summary.evaluate((node) => node === document.activeElement))
        break;
      await page.keyboard.press("Tab");
    }
    await expect(summary).toBeFocused();
    await expect(summary).toHaveCSS("outline-style", "solid");
    await expect(summary).toHaveCSS("outline-width", "2px");
    await expect(summary).toHaveCSS(
      "outline-color",
      await paletteColor("light", "--mbk-sage-deep"),
    );
    await expect(summary).toHaveAccessibleName(NOTICE_COPY.show);
    const closed = (await summary.boundingBox())!;
    await page.keyboard.press("Enter");
    await expect(page.locator(".mbk-rebuild-details")).toHaveAttribute(
      "open",
      "",
    );
    await expect(summary).toBeFocused();
    await expect(summary).toHaveAccessibleName(NOTICE_COPY.hide);
    await expect(page.locator(".mbk-rebuild-detail")).toBeVisible();
    expect(await summary.boundingBox()).toEqual(closed);
    await page.keyboard.press("Space");
    await expect(summary).toHaveAccessibleName(NOTICE_COPY.show);
    await expect(page.locator(".mbk-rebuild-detail")).toBeHidden();
  });

  test(`${viewport}: reduced motion stills the ring and keeps the text and geometry`, async ({
    page,
  }) => {
    const route = fragment(state("design/rebuild-status/updating"), viewport);
    await open(page, route, viewport);
    const spinner = page.locator(".mbk-progress-spinner");
    await expect(spinner).toHaveCSS("animation-name", "mbk-progress-spin");
    const moving = await page.locator(".mbk-progress").boundingBox();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, route, viewport);
    await expect(spinner).toHaveCSS("animation-name", "none");
    await expect(page.locator(".mbk-progress")).toHaveText(PROGRESS_COPY);
    expect(await page.locator(".mbk-progress").boundingBox()).toEqual(moving);
  });

  test(`${viewport}: the disclosed detail wraps within its bound`, async ({
    page,
  }) => {
    await open(
      page,
      fragment(state("design/rebuild-status/details"), viewport),
      viewport,
    );
    const detail = page.locator(".mbk-rebuild-detail");
    await expect(detail).toHaveCSS("white-space", "pre-wrap");
    await expect(detail).toHaveCSS("overflow-wrap", "anywhere");
    const measured = await detail.evaluate((node) => ({
      lines: node.textContent?.split("\n").length ?? 0,
      height: node.getBoundingClientRect().height,
      overflow: node.scrollWidth - node.clientWidth,
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }));
    expect(measured.lines).toBe(3);
    expect(measured.height).toBeLessThanOrEqual(168);
    expect(measured.overflow, "no sideways scrolling in the detail").toBe(0);
    expect(measured.page, "no sideways page scrolling").toBe(0);
  });

  test(`${viewport}: the notice uses the palette and one complete outline`, async ({
    page,
  }) => {
    await open(
      page,
      fragment(state("design/rebuild-status/failure-updating"), viewport),
      viewport,
    );
    const card = page.locator(".mbk-rebuild-card");
    const edge = await paletteColor("light", "--mbk-danger-edge");
    await expect(card).toHaveCSS(
      "background-color",
      await paletteColor("light", "--mbk-danger-bg"),
    );
    for (const side of ["top", "right", "bottom", "left"]) {
      await expect(card).toHaveCSS(`border-${side}-width`, "1px");
      await expect(card).toHaveCSS(`border-${side}-style`, "solid");
      await expect(card).toHaveCSS(`border-${side}-color`, edge);
    }
    await expect(card).toHaveCSS("box-shadow", "none");
    await expect(card).toHaveCSS("background-image", "none");
    for (const selector of [".mbk-rebuild", ".mbk-rebuild-card"])
      for (const pseudo of ["::before", "::after"])
        expect(
          await page
            .locator(selector)
            .evaluate(
              (node, which) => getComputedStyle(node, which).content,
              pseudo,
            ),
        ).toBe("none");
    for (const [selector, token] of [
      [".mbk-rebuild-copy h2", "--chrome-ink"],
      [".mbk-rebuild-copy p", "--chrome-ink-2"],
      [".mbk-rebuild-icon", "--mbk-danger-ink"],
      [".mbk-rebuild-details > summary", "--mbk-danger-ink"],
      [".mbk-progress", "--chrome-muted"],
    ] as const)
      await expect(page.locator(selector)).toHaveCSS(
        "color",
        await paletteColor("light", token),
      );
  });
}
