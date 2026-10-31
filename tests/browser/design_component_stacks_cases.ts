import { expect, type Locator, type Page } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { componentDesignFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerDesignComponentStacks(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { componentDesignUrl } = componentDesignFixture(
    test,
    mode === "static" ? copiedDesignFileUrl : undefined,
  );

  type Viewport = "desktop" | "mobile";

  /** Component routes whose comparisons stack both versions in one frame. */
  const STACKED = [
    ["design/components/pages/stacked/overlay", "overlay"],
    ["design/components/pages/stacked/difference", "difference"],
    ["design/components/pages/stacked/overlay-tall", "overlay"],
  ] as const;

  async function open(
    page: Page,
    route: string,
    viewport: Viewport,
  ): Promise<Locator> {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    await page.goto(componentDesignUrl(route, viewport));
    const scroller = page.locator(
      `.ce-preview-view[data-preview-viewport="${viewport}"] .mb-viewport`,
    );
    await expect(scroller, route).toHaveCount(1);
    await expect(scroller, route).toBeVisible();
    return scroller;
  }

  for (const viewport of ["desktop", "mobile"] as const) {
    test(`${viewport}: component stacks share one bordered frame and one offset`, async ({
      page,
    }, testInfo) => {
      for (const [route, mode] of STACKED) {
        const scroller = await open(page, route, viewport);
        const facts = await scroller.evaluate((node) => {
          const box = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return [rect.left, rect.top, rect.width, rect.height];
          };
          const frame = node.closest(".mb-component-frame")!;
          const stack = node.querySelector(".mb-viewport-box")!;
          const before = node.querySelector(".mb-pane--before")!;
          const after = node.querySelector(".mb-pane--after")!;
          const surface = (layer: Element) =>
            layer.querySelector(":scope > .mb-pane-doc")!;
          const blended: string[] = [];
          for (
            let ancestor: Element | null = frame;
            ancestor && !ancestor.classList.contains("ce-preview-view");
            ancestor = ancestor.parentElement
          ) {
            const style = getComputedStyle(ancestor);
            if (style.mixBlendMode !== "normal" || style.opacity !== "1")
              blended.push(ancestor.className);
          }
          // A scroll container that has no range cannot move: the shipped
          // viewport scrolls in the shell, and a static artboard draws it.
          const scrollers = [frame, ...frame.querySelectorAll("*")].filter(
            (element) =>
              /auto|scroll/u.test(
                `${getComputedStyle(element).overflowX} ${getComputedStyle(element).overflowY}`,
              ) &&
              (element.scrollHeight > element.clientHeight ||
                element.scrollWidth > element.clientWidth),
          );
          const heading = node
            .closest(".mbk-diff-view")!
            .querySelector(":scope > h3")!;
          return {
            after: box(after),
            afterBackground: getComputedStyle(surface(after)).backgroundColor,
            afterBlend: getComputedStyle(after).mixBlendMode,
            afterOpacity: getComputedStyle(after).opacity,
            before: box(before),
            beforeBackground: getComputedStyle(surface(before)).backgroundColor,
            beforeBlend: getComputedStyle(before).mixBlendMode,
            beforeOpacity: getComputedStyle(before).opacity,
            blended,
            frameHeight: frame.clientHeight,
            headingBlend: getComputedStyle(heading).mixBlendMode,
            headingBottom: heading.getBoundingClientRect().bottom,
            documentHeights: [
              ...node.querySelectorAll(".mbk-stack-document"),
            ].map((document) => document.getBoundingClientRect().height),
            isolation: getComputedStyle(stack).isolation,
            scrollerHeight: node.getBoundingClientRect().height,
            scrollerTop: node.getBoundingClientRect().top,
            scrollers: scrollers.map((element) => element.className),
            scrolls: node.scrollTop,
          };
        });
        const where = `${route} ${viewport}`;
        expect(facts.after, `${where}: layers coincide`).toEqual(facts.before);
        expect(facts.scrollerHeight, `${where}: canvas height`).toBe(
          facts.frameHeight,
        );
        expect(facts.documentHeights, where).toHaveLength(2);
        for (const height of facts.documentHeights)
          expect(height, where).toBeGreaterThanOrEqual(facts.scrollerHeight);
        expect(facts.headingBottom, where).toBeLessThanOrEqual(
          facts.scrollerTop,
        );
        expect(facts.scrolls, where).toBe(0);
        expect(facts.scrollers, `${where}: no inner scroll container`).toEqual(
          [],
        );
        expect(facts.isolation, where).toBe("isolate");
        expect(facts.beforeBackground, where).toBe("rgb(255, 255, 255)");
        expect(facts.afterBackground, where).toBe(facts.beforeBackground);
        expect([facts.beforeBlend, facts.beforeOpacity], where).toEqual([
          "normal",
          "1",
        ]);
        expect([facts.afterBlend, facts.afterOpacity], where).toEqual(
          mode === "overlay" ? ["normal", "0.5"] : ["difference", "1"],
        );
        expect(facts.blended, `${where}: the frame never blends`).toEqual([]);
        expect(facts.headingBlend, where).toBe("normal");
        await page.screenshot({
          path: testInfo.outputPath(
            `${route.replaceAll("/", "-")}.${viewport}.png`,
          ),
        });
      }
    });

    test(`${viewport}: Action's versions sit at one position in the frame`, async ({
      page,
    }) => {
      for (const [route] of STACKED.slice(0, 2)) {
        const scroller = await open(page, route, viewport);
        const facts = await scroller.evaluate((node) => {
          const frame = node.getBoundingClientRect();
          // Each version's document draws its Action from the top left, as
          // the shell's documents do, so the two corners coincide.
          const corner = (side: string) => {
            const rect = node
              .querySelector(`.mb-pane--${side} .ce-action`)!
              .getBoundingClientRect();
            return [rect.left - frame.left, rect.top - frame.top];
          };
          return {
            after: corner("after"),
            before: corner("before"),
            scrollbars: node.querySelectorAll(".mbk-stack-scrollbar").length,
            stackHeights: [...node.querySelectorAll(".mbk-stack-document")].map(
              (document) => document.getBoundingClientRect().height,
            ),
            viewportHeight: node.getBoundingClientRect().height,
          };
        });
        facts.after.forEach((value, index) =>
          expect(Math.abs(value - facts.before[index]!), route).toBeLessThan(
            0.5,
          ),
        );
        expect(
          facts.before,
          `${route}: 24px from the frame's top left, as the shell's documents draw it`,
        ).toEqual([24, 24]);
        expect(facts.stackHeights, `${route}: fits its frame`).toEqual([
          facts.viewportHeight,
          facts.viewportHeight,
        ]);
        expect(facts.scrollbars, route).toBe(0);
      }
    });

    test(`${viewport}: the tall Checklist is drawn part-way down one frame`, async ({
      page,
    }) => {
      const scroller = await open(
        page,
        "design/components/pages/stacked/overlay-tall",
        viewport,
      );
      const facts = await scroller.evaluate((node) => {
        const frame = node.getBoundingClientRect();
        const stack = node.querySelector(
          ".mb-pane--before .mbk-stack-document",
        )!;
        const rows = (side: string) =>
          [
            ...node.querySelectorAll(
              `.mb-pane--${side} .ce-checklist-steps > li`,
            ),
          ].map((row) => {
            const rect = row.getBoundingClientRect();
            return {
              bottom: rect.bottom - frame.top,
              text: row.textContent,
              top: rect.top - frame.top,
            };
          });
        const track = node
          .querySelector(".mbk-stack-scrollbar")!
          .getBoundingClientRect();
        const thumb = node
          .querySelector(".mbk-stack-thumb")!
          .getBoundingClientRect();
        return {
          after: rows("after"),
          before: rows("before"),
          offset: frame.top - stack.getBoundingClientRect().top,
          stackHeight: stack.getBoundingClientRect().height,
          thumbSize: thumb.height / track.height,
          thumbStart: (thumb.top - track.top) / track.height,
          track: [
            track.top - frame.top,
            track.bottom - frame.bottom,
            track.right - frame.right,
          ],
          translate: new DOMMatrixReadOnly(getComputedStyle(stack).transform)
            .m42,
          viewportHeight: frame.height,
        };
      });
      expect(facts.offset, "the drawn offset").toBe(-facts.translate);
      expect(facts.offset, "scrolled").toBeGreaterThan(0);
      expect(facts.offset, "not at the end").toBeLessThan(
        facts.stackHeight - facts.viewportHeight,
      );
      expect(facts.stackHeight).toBeGreaterThan(facts.viewportHeight * 2);
      expect(
        facts.after.map((row) => [row.top, row.bottom]),
        "every step shares one offset",
      ).toEqual(facts.before.map((row) => [row.top, row.bottom]));
      const reworded = facts.before.filter(
        (row, index) => row.text !== facts.after[index]?.text,
      );
      expect(reworded, "one reworded step").toHaveLength(1);
      expect(reworded[0]!.top, "the change is in view").toBeGreaterThanOrEqual(
        0,
      );
      expect(reworded[0]!.bottom).toBeLessThanOrEqual(facts.viewportHeight);
      expect(facts.track, "the scrollbar spans the frame").toEqual([0, 0, 0]);
      expect(
        Math.abs(facts.thumbStart - facts.offset / facts.stackHeight),
        "thumb position matches the offset",
      ).toBeLessThan(0.005);
      expect(
        Math.abs(facts.thumbSize - facts.viewportHeight / facts.stackHeight),
        "thumb size matches the shown share",
      ).toBeLessThan(0.005);
    });

    test(`${viewport}: Action's comparison modes open their own artboards`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
      );
      await page.goto(
        componentDesignUrl("design/components/pages/comparison", viewport),
      );
      const modes = page.getByRole("group", { name: "Comparison mode" });
      for (const [label, route] of [
        ["Overlay", "design/components/pages/stacked/overlay"],
        ["Difference", "design/components/pages/stacked/difference"],
        ["Current", "design/components/pages/affected"],
        ["Side by side", "design/components/pages/comparison"],
      ] as const) {
        const link = modes.getByRole("link", { name: label, exact: true });
        await link.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(componentDesignUrl(route, viewport));
        await expect(
          modes.getByRole("button", { name: label, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
      }
    });
  }
}
