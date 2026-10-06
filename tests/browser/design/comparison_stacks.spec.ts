import { expect, test, type Locator, type Page } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

type Scheme = "dark" | "light";
type Viewport = "desktop" | "mobile";

/** Design routes whose comparisons stack both versions in one chrome. */
const STACKED = [
  ["design/changes/diff-controls/overlay", "overlay"],
  ["design/changes/diff-controls/overlay-long", "overlay"],
  ["design/changes/diff-controls/overlay-panel", "overlay"],
  ["design/changes/outcomes/difference", "difference"],
  ["design/browse/appearance/workspaces/difference", "difference"],
] as const;

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
): Promise<Locator> {
  await page.setViewportSize(
    viewport === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  );
  const file = `${route}/index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
  await page.goto(designArtboardUrl(route, viewport, scheme));
  const scroller = page.locator(
    `.ce-preview-view[data-preview-viewport="${viewport}"] .mbk-stack-viewport`,
  );
  await expect(scroller, file).toHaveCount(1);
  await expect(scroller, file).toBeVisible();
  return scroller;
}

for (const viewport of ["desktop", "mobile"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${viewport} ${scheme}: stacked comparisons share one chrome and one offset`, async ({
      page,
    }, testInfo) => {
      for (const [route, mode] of STACKED) {
        const scroller = await open(page, route, viewport, scheme);
        const facts = await scroller.evaluate((node) => {
          const box = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return [rect.left, rect.top, rect.width, rect.height];
          };
          const stack = node.querySelector(".mbk-stack")!;
          const before = node.querySelector(".mbk-stack-layer--before")!;
          const after = node.querySelector(".mbk-stack-layer--after")!;
          const chrome = node.closest(".browser-frame, .phone-frame")!;
          const blended: string[] = [];
          for (
            let ancestor: Element | null = chrome;
            ancestor && !ancestor.classList.contains("ce-preview-view");
            ancestor = ancestor.parentElement
          ) {
            const style = getComputedStyle(ancestor);
            if (style.mixBlendMode !== "normal" || style.opacity !== "1")
              blended.push(ancestor.className);
          }
          return {
            after: box(after),
            afterBackground: getComputedStyle(after).backgroundColor,
            afterBlend: getComputedStyle(after).mixBlendMode,
            afterOpacity: getComputedStyle(after).opacity,
            before: box(before),
            beforeBackground: getComputedStyle(before).backgroundColor,
            beforeBlend: getComputedStyle(before).mixBlendMode,
            beforeOpacity: getComputedStyle(before).opacity,
            blended,
            isolation: getComputedStyle(stack).isolation,
            overflow: getComputedStyle(node).overflow,
            scrollerHeight: node.getBoundingClientRect().height,
            stackHeight: stack.getBoundingClientRect().height,
            scrolls: node.scrollTop,
          };
        });
        const where = `${route} ${viewport} ${scheme}`;
        expect(facts.after, `${where}: layers coincide`).toEqual(facts.before);
        expect(facts.stackHeight, where).toBeGreaterThanOrEqual(
          facts.scrollerHeight - 1,
        );
        expect(facts.overflow, where).toBe("hidden");
        expect(facts.scrolls, where).toBe(0);
        expect(facts.isolation, where).toBe("isolate");
        expect(facts.beforeBackground, where).toBe(SCREEN_BACKGROUND[scheme]);
        expect(facts.afterBackground, where).toBe(SCREEN_BACKGROUND[scheme]);
        expect([facts.beforeBlend, facts.beforeOpacity], where).toEqual([
          "normal",
          "1",
        ]);
        expect([facts.afterBlend, facts.afterOpacity], where).toEqual(
          mode === "overlay" ? ["normal", "0.5"] : ["difference", "1"],
        );
        expect(facts.blended, `${where}: the chrome never blends`).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(
            `${route.replaceAll("/", "-")}.${viewport}.${scheme}.png`,
          ),
        });
      }
    });
  }
}

test("the long overlay depicts both versions part-way down one viewport", async ({
  page,
}) => {
  for (const viewport of ["desktop", "mobile"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const where = `${viewport} ${scheme}`;
      const scroller = await open(
        page,
        "design/changes/diff-controls/overlay-long",
        viewport,
        scheme,
      );
      const facts = await scroller.evaluate((node) => {
        const top = node.getBoundingClientRect().top;
        const headings = (side: string) =>
          [
            ...node.querySelectorAll(
              `.mbk-stack-layer--${side} .mbk-shot-sections h3`,
            ),
          ].map((heading) => ({
            text: heading.textContent,
            top: heading.getBoundingClientRect().top - top,
          }));
        const stack = node.querySelector(".mbk-stack")!.getBoundingClientRect();
        const track = node
          .querySelector(".mbk-stack-scrollbar")!
          .getBoundingClientRect();
        const thumb = node
          .querySelector(".mbk-stack-thumb")!
          .getBoundingClientRect();
        const viewport = node.getBoundingClientRect();
        return {
          after: headings("after"),
          before: headings("before"),
          offset: top - stack.top,
          stackHeight: stack.height,
          thumbSize: thumb.height / track.height,
          thumbStart: (thumb.top - track.top) / track.height,
          thumbWithinTrack:
            thumb.top >= track.top && thumb.bottom <= track.bottom,
          trackRight: track.right,
          viewportHeight: viewport.height,
          viewportRight: viewport.right,
        };
      });
      expect(facts.stackHeight, where).toBeGreaterThan(
        facts.viewportHeight * 1.5,
      );
      expect(facts.offset, `${where}: scrolled`).toBeGreaterThan(0);
      expect(facts.offset, `${where}: not at the end`).toBeLessThan(
        facts.stackHeight - facts.viewportHeight,
      );
      expect(
        facts.after.map((heading) => heading.top),
        `${where}: every section shares one offset`,
      ).toEqual(facts.before.map((heading) => heading.top));
      expect(
        facts.before.some(
          (heading) => heading.top > 0 && heading.top < facts.viewportHeight,
        ),
        where,
      ).toBe(true);
      const reworded = facts.before.flatMap((heading, index) =>
        heading.text === facts.after[index]?.text ? [] : [heading.top],
      );
      expect(reworded, `${where}: one reworded section`).toHaveLength(1);
      expect(reworded[0], `${where}: the change is in view`).toBeGreaterThan(0);
      expect(reworded[0]!, where).toBeLessThan(facts.viewportHeight);
      expect(facts.thumbWithinTrack, where).toBe(true);
      expect(facts.trackRight, where).toBeCloseTo(facts.viewportRight, 0);
      expect(
        Math.abs(facts.thumbStart - facts.offset / facts.stackHeight),
        `${where}: thumb position matches the offset`,
      ).toBeLessThan(0.08);
      expect(
        Math.abs(facts.thumbSize - facts.viewportHeight / facts.stackHeight),
        `${where}: thumb size matches the visible share`,
      ).toBeLessThan(0.08);
    }
  }
});
