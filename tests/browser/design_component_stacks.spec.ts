import { expect, test, type Locator, type Page } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

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
    `.ce-preview-view[data-preview-viewport="${viewport}"] .mbk-stack-viewport`,
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
        const frame = node.closest(".ce-canvas")!;
        const stack = node.querySelector(".mbk-stack")!;
        const before = node.querySelector(".mbk-stack-layer--before")!;
        const after = node.querySelector(".mbk-stack-layer--after")!;
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
        const scrollers = [frame, ...frame.querySelectorAll("*")].filter(
          (element) =>
            /auto|scroll/u.test(
              `${getComputedStyle(element).overflowX} ${getComputedStyle(element).overflowY}`,
            ),
        );
        const caption = frame.querySelector(".ce-canvas-label")!;
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
          captionBlend: getComputedStyle(caption).mixBlendMode,
          captionBottom: caption.getBoundingClientRect().bottom,
          frameBackground: getComputedStyle(frame).backgroundColor,
          frameHeight: parseFloat(
            getComputedStyle(frame).getPropertyValue("--ce-canvas-height"),
          ),
          isolation: getComputedStyle(stack).isolation,
          overflow: getComputedStyle(node).overflow,
          scrollerHeight: node.getBoundingClientRect().height,
          scrollerTop: node.getBoundingClientRect().top,
          scrollers: scrollers.map((element) => element.className),
          scrolls: node.scrollTop,
          stackHeight: stack.getBoundingClientRect().height,
        };
      });
      const where = `${route} ${viewport}`;
      expect(facts.after, `${where}: layers coincide`).toEqual(facts.before);
      expect(facts.scrollerHeight, `${where}: canvas height`).toBe(
        facts.frameHeight,
      );
      expect(facts.stackHeight, where).toBeGreaterThanOrEqual(
        facts.scrollerHeight,
      );
      expect(facts.captionBottom, where).toBeLessThanOrEqual(facts.scrollerTop);
      expect(facts.overflow, where).toBe("hidden");
      expect(facts.scrolls, where).toBe(0);
      expect(facts.scrollers, `${where}: no inner scroll container`).toEqual(
        [],
      );
      expect(facts.isolation, where).toBe("isolate");
      expect(facts.frameBackground, where).toBe("rgb(255, 255, 255)");
      expect(facts.beforeBackground, where).toBe(facts.frameBackground);
      expect(facts.afterBackground, where).toBe(facts.frameBackground);
      expect([facts.beforeBlend, facts.beforeOpacity], where).toEqual([
        "normal",
        "1",
      ]);
      expect([facts.afterBlend, facts.afterOpacity], where).toEqual(
        mode === "overlay" ? ["normal", "0.5"] : ["difference", "1"],
      );
      expect(facts.blended, `${where}: the frame never blends`).toEqual([]);
      expect(facts.captionBlend, where).toBe("normal");
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
        const center = (side: string) => {
          const rect = node
            .querySelector(`.mbk-stack-layer--${side} .ce-action`)!
            .getBoundingClientRect();
          return [rect.left + rect.width / 2, rect.top + rect.height / 2];
        };
        return {
          after: center("after"),
          before: center("before"),
          scrollbars: node.querySelectorAll(".mbk-stack-scrollbar").length,
          stackHeight: node.querySelector(".mbk-stack")!.getBoundingClientRect()
            .height,
          viewportHeight: node.getBoundingClientRect().height,
        };
      });
      facts.after.forEach((value, index) =>
        expect(Math.abs(value - facts.before[index]!), route).toBeLessThan(0.5),
      );
      expect(facts.stackHeight, `${route}: fits its frame`).toBe(
        facts.viewportHeight,
      );
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
      const stack = node.querySelector(".mbk-stack")!;
      const rows = (side: string) =>
        [
          ...node.querySelectorAll(
            `.mbk-stack-layer--${side} .ce-checklist-steps > li`,
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
        translate: new DOMMatrixReadOnly(getComputedStyle(stack).transform).m42,
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
    expect(reworded[0]!.top, "the change is in view").toBeGreaterThanOrEqual(0);
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
