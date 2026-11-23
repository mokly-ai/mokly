import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test as baseTest } from "./browser_test.js";
import { designFileUrl as servedDesignFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerDesignComparisonStacks(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const designFileUrl =
    mode === "static" ? copiedDesignFileUrl : servedDesignFileUrl;
  type Scheme = "dark" | "light";
  type Viewport = "desktop" | "mobile";

  /**
   * Canvas designs whose frames stack both versions in the shipped viewport:
   * Welcome on the Changes tab, the moved Invoice, and the Action's variant
   * set, each in its stacked compare mode.
   */
  const STACKED = [
    ["design/canvas/changes/overlay", "overlay"],
    ["design/canvas/changes/difference", "difference"],
    ["design/canvas/outcomes/moved", "overlay"],
    ["design/canvas/components/compare", "overlay"],
    ["design/canvas/components/compare/difference", "difference"],
  ] as const;

  /** Welcome on the Changes tab in each compare mode that draws versions. */
  const COMPARED = [
    "design/canvas/changes/side-by-side",
    "design/canvas/changes/overlay",
    "design/canvas/changes/difference",
    "design/canvas/changes/swipe",
  ];

  /** The opaque screen background each depicted scheme paints under a blend. */
  const SCREEN_BACKGROUND: Record<Scheme, string> = {
    dark: "rgb(18, 21, 20)",
    light: "rgb(255, 255, 255)",
  };

  async function open(
    page: Page,
    route: string,
    viewport: Viewport,
    scheme: Scheme,
  ): Promise<string> {
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
    await expect(page.locator(".cv-root"), file).toHaveCount(1);
    return file;
  }

  for (const viewport of ["desktop", "mobile"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${viewport} ${scheme}: stacked comparisons share each frame and one offset`, async ({
        page,
      }, testInfo) => {
        for (const [route, mode] of STACKED) {
          const file = await open(page, route, viewport, scheme);
          // Each frame on the stage that the artboard shows; a phone shows
          // one frame of a screen and hides the others.
          const frames = await page.evaluate(() =>
            [...document.querySelectorAll(".cv-frame[data-cv-frame]")]
              .filter((frame) => frame.getClientRects().length > 0)
              .map((frame) => {
                const box = (element: Element) => {
                  const rect = element.getBoundingClientRect();
                  return [rect.left, rect.top, rect.width, rect.height];
                };
                const node = frame.querySelector(".mb-viewport")!;
                const stack = node.querySelector(".mb-viewport-box")!;
                const before = node.querySelector(".mb-pane--before")!;
                const after = node.querySelector(".mb-pane--after")!;
                const surface = (layer: Element) =>
                  layer.querySelector(":scope > .mb-pane-doc")!;
                const blended: string[] = [];
                for (
                  let ancestor: Element | null = node;
                  ancestor && !ancestor.classList.contains("cv-canvas");
                  ancestor = ancestor.parentElement
                ) {
                  const style = getComputedStyle(ancestor);
                  if (style.mixBlendMode !== "normal" || style.opacity !== "1")
                    blended.push(ancestor.className);
                }
                const declared = getComputedStyle(frame);
                return {
                  after: box(after),
                  afterBackground: getComputedStyle(surface(after))
                    .backgroundColor,
                  afterBlend: getComputedStyle(after).mixBlendMode,
                  afterOpacity: getComputedStyle(after).opacity,
                  before: box(before),
                  beforeBackground: getComputedStyle(surface(before))
                    .backgroundColor,
                  beforeBlend: getComputedStyle(before).mixBlendMode,
                  beforeOpacity: getComputedStyle(before).opacity,
                  blended,
                  documentHeights: [
                    ...node.querySelectorAll(".mb-pane-doc"),
                  ].map((document) => document.getBoundingClientRect().height),
                  frame: frame.getAttribute("data-cv-frame"),
                  isolation: getComputedStyle(stack).isolation,
                  // The frame's own size, before the stage's zoom.
                  nominal: ["--cv-frame-w", "--cv-frame-h"].map((property) =>
                    Number(declared.getPropertyValue(property)),
                  ),
                  // The shipped viewport scrolls in the shell; a static
                  // artboard draws its position, so it has no range to scroll.
                  range: node.scrollHeight - node.clientHeight,
                  scheme: frame.getAttribute("data-cv-scheme") as
                    "dark" | "light",
                  scrollerHeight: node.getBoundingClientRect().height,
                  scrolls: node.scrollTop,
                  size: [node.clientWidth, node.clientHeight],
                };
              }),
          );
          expect(frames.length, `${file}: a stacked frame`).toBeGreaterThan(0);
          for (const facts of frames) {
            const where = `${file} ${facts.frame}`;
            expect(facts.after, `${where}: layers coincide`).toEqual(
              facts.before,
            );
            expect(facts.documentHeights, where).toHaveLength(2);
            for (const height of facts.documentHeights)
              expect(height, where).toBeGreaterThanOrEqual(
                facts.scrollerHeight - 1,
              );
            expect(facts.size, `${where}: the frame's own size`).toEqual(
              facts.nominal,
            );
            expect(facts.range, where).toBe(0);
            expect(facts.scrolls, where).toBe(0);
            expect(facts.isolation, where).toBe("isolate");
            expect(facts.beforeBackground, where).toBe(
              SCREEN_BACKGROUND[facts.scheme],
            );
            expect(facts.afterBackground, where).toBe(
              SCREEN_BACKGROUND[facts.scheme],
            );
            expect([facts.beforeBlend, facts.beforeOpacity], where).toEqual([
              "normal",
              "1",
            ]);
            expect([facts.afterBlend, facts.afterOpacity], where).toEqual(
              mode === "overlay" ? ["normal", "0.5"] : ["difference", "1"],
            );
            expect(facts.blended, `${where}: the frame never blends`).toEqual(
              [],
            );
          }
          await page.screenshot({
            path: testInfo.outputPath(
              `${route.replaceAll("/", "-")}.${viewport}.${scheme}.png`,
            ),
          });
        }
      });

      test(`${viewport} ${scheme}: depicted screens keep their own ink inside a comparison`, async ({
        page,
      }) => {
        for (const route of COMPARED) {
          const file = await open(page, route, viewport, scheme);
          const headings = await page.evaluate(() =>
            [
              ...document.querySelectorAll(
                ".cv-frame .mbk-shot :is(h1, h2, h3)",
              ),
            ].map((heading) => [
              getComputedStyle(heading).color,
              getComputedStyle(heading.closest(".mbk-shot")!).color,
            ]),
          );
          expect(headings.length, file).toBeGreaterThan(0);
          for (const [heading, screen] of headings)
            expect(heading, `${file}: the screen's ink`).toBe(screen);
        }
      });
    }
  }
}
