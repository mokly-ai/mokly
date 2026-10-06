import { expect, test, type Locator, type Page } from "@playwright/test";

import { paletteColor } from "../../helpers/design_palette.js";

import { designArtboardUrl } from "./artboards.js";

type Scheme = "dark" | "light";
type Viewport = "desktop" | "mobile";

const PANEL = "design/changes/diff-controls/overlay-panel";
const APART = "design/changes/diff-controls/side-by-side-apart";

/** Tolerance for a drawn thumb, whose geometry is fixed by CSS alone. */
const THUMB_TOLERANCE = 0.005;

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
  const preview = page.locator(
    `.ce-preview-view[data-preview-viewport="${viewport}"]`,
  );
  await expect(preview, file).toHaveCount(1);
  return preview;
}

for (const viewport of ["desktop", "mobile"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    const where = `${viewport} ${scheme}`;

    test(`${where}: the panel overlay scrolls one panel for both versions`, async ({
      page,
    }) => {
      const preview = await open(page, PANEL, viewport, scheme);
      const facts = await preview
        .locator(".mbk-stack-viewport")
        .evaluate((node) => {
          const view = node.getBoundingClientRect();
          const box = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return [rect.left, rect.top, rect.width, rect.height];
          };
          const shell = (side: string) =>
            node.querySelector(`.mbk-stack-layer--${side} .mbk-shot--app`)!;
          const parts = (name: string) =>
            ["before", "after"].map((side) =>
              box(shell(side).querySelector(name)!),
            );
          const panel = shell("before").querySelector(".mbk-app-panel")!;
          const area = panel.getBoundingClientRect();
          const content = panel.querySelector(".mbk-app-panel-content")!;
          const rows = (side: string) =>
            [
              ...shell(side).querySelectorAll(".mbk-shot-sections > section"),
            ].map((row) => {
              const rect = row.getBoundingClientRect();
              return {
                bottom: rect.bottom - area.top,
                height: rect.height,
                text: row.textContent,
                top: rect.top - area.top,
              };
            });
          const track = panel
            .querySelector(".mbk-scrollbar")!
            .getBoundingClientRect();
          const thumb = panel
            .querySelector(".mbk-scrollbar-thumb")!
            .getBoundingClientRect();
          const scrollers = [node, ...node.querySelectorAll("*")].filter(
            (element) =>
              /auto|scroll/u.test(
                `${getComputedStyle(element).overflowX} ${getComputedStyle(element).overflowY}`,
              ),
          );
          return {
            after: rows("after"),
            bars: parts(".mbk-app-bar"),
            before: rows("before"),
            contentHeight: content.getBoundingClientRect().height,
            navs: parts(".mbk-app-nav"),
            offset: area.top - content.getBoundingClientRect().top,
            pageScrollbars: node.querySelectorAll(
              ":scope > .mbk-stack-scrollbar, :scope > .mbk-scrollbar",
            ).length,
            panelHeight: area.height,
            panels: parts(".mbk-app-panel"),
            scrollers: scrollers.map((element) => element.className),
            shells: ["before", "after"].map((side) => box(shell(side))),
            stackHeight: node
              .querySelector(".mbk-stack")!
              .getBoundingClientRect().height,
            thumbSize: thumb.height / track.height,
            thumbStart: (thumb.top - track.top) / track.height,
            track: [
              track.top - area.top,
              track.bottom - area.bottom,
              track.right - area.right,
            ],
            translate: new DOMMatrixReadOnly(
              getComputedStyle(content).transform,
            ).m42,
            view: [view.left, view.top, view.width, view.height],
          };
        });
      expect(facts.stackHeight, "the page has nothing to scroll").toBe(
        facts.view[3],
      );
      expect(facts.pageScrollbars, "no page scrollbar").toBe(0);
      expect(facts.scrollers, "every position is drawn").toEqual([]);
      for (const shell of facts.shells)
        expect(shell, "each app shell fills the viewport").toEqual(facts.view);
      for (const [name, pair] of [
        ["bar", facts.bars],
        ["navigation", facts.navs],
        ["panel", facts.panels],
      ] as const)
        expect(pair[1], `${where}: the ${name} lines up`).toEqual(pair[0]);
      const [bar, nav, panel] = [
        facts.bars[0]!,
        facts.navs[0]!,
        facts.panels[0]!,
      ];
      expect(bar[1], "the top bar stays at the top").toBe(facts.view[1]);
      if (viewport === "desktop") {
        expect(nav[0], "the navigation stays at the side").toBe(facts.view[0]);
        expect(panel[0]).toBe(nav[0]! + nav[2]!);
      } else {
        expect(nav[1]! + nav[3]!, "the tab bar stays at the bottom").toBe(
          facts.view[1]! + facts.view[3]!,
        );
        expect(panel[1]! + panel[3]!).toBe(nav[1]);
      }
      expect(panel[1]).toBe(bar[1]! + bar[3]!);
      expect(facts.offset, "the drawn offset").toBe(-facts.translate);
      expect(facts.offset, "scrolled").toBeGreaterThan(0);
      expect(facts.offset, "not at the end").toBeLessThan(
        facts.contentHeight - facts.panelHeight,
      );
      expect(
        new Set(facts.before.map((row) => row.height)).size,
        "fixed rows",
      ).toBe(1);
      expect(
        facts.after.map((row) => [row.top, row.bottom]),
        "both panels share one offset",
      ).toEqual(facts.before.map((row) => [row.top, row.bottom]));
      const reworded = facts.before.filter(
        (row, index) => row.text !== facts.after[index]?.text,
      );
      expect(reworded, "one reworded section").toHaveLength(1);
      expect(reworded[0]!.top, "the change is in view").toBeGreaterThanOrEqual(
        0,
      );
      expect(reworded[0]!.bottom).toBeLessThanOrEqual(facts.panelHeight);
      expect(facts.track, "the scrollbar spans the panel").toEqual([0, 0, 0]);
      expect(
        Math.abs(facts.thumbStart - facts.offset / facts.contentHeight),
      ).toBeLessThan(THUMB_TOLERANCE);
      expect(
        Math.abs(facts.thumbSize - facts.panelHeight / facts.contentHeight),
      ).toBeLessThan(THUMB_TOLERANCE);
    });

    test(`${where}: Side by side scrolled apart keeps each version's own place`, async ({
      page,
    }) => {
      const preview = await open(page, APART, viewport, scheme);
      const sides = await preview.locator(".mbk-compare").evaluate((compare) =>
        [...compare.querySelectorAll(":scope > .mbk-compare-side")].map(
          (side) => {
            const view = side.querySelector(".mbk-page-viewport")!;
            const area = view.getBoundingClientRect();
            const content = view.querySelector(".mbk-shot--page")!;
            const track = view
              .querySelector(".mbk-scrollbar")!
              .getBoundingClientRect();
            const thumb = view
              .querySelector(".mbk-scrollbar-thumb")!
              .getBoundingClientRect();
            return {
              chrome: view.parentElement!.classList.contains("browser-viewport")
                ? "browser"
                : view.parentElement!.classList.contains("phone-screen")
                  ? "phone"
                  : "other",
              contentHeight: content.getBoundingClientRect().height,
              label: side.querySelector(".mbk-compare-label")!.textContent,
              offset: area.top - content.getBoundingClientRect().top,
              rows: [
                ...content.querySelectorAll(".mbk-shot-sections > section"),
              ].map((row) => row.getBoundingClientRect().top - area.top),
              thumbSize: thumb.height / track.height,
              thumbStart: (thumb.top - track.top) / track.height,
              track: [
                track.top - area.top,
                track.bottom - area.bottom,
                track.right - area.right,
              ],
              translate: new DOMMatrixReadOnly(
                getComputedStyle(content).transform,
              ).m42,
              viewHeight: area.height,
            };
          },
        ),
      );
      expect(sides.map((side) => side.label)).toEqual(["Before", "Current"]);
      for (const side of sides) {
        const pane = `${where} ${side.label}`;
        expect(side.chrome, pane).toBe(
          viewport === "desktop" ? "browser" : "phone",
        );
        expect(side.offset, `${pane}: the drawn offset`).toBe(-side.translate);
        expect(side.offset, pane).toBeGreaterThan(0);
        expect(side.offset, pane).toBeLessThan(
          side.contentHeight - side.viewHeight,
        );
        expect(side.track, `${pane}: its own scrollbar`).toEqual([0, 0, 0]);
        expect(
          Math.abs(side.thumbStart - side.offset / side.contentHeight),
          pane,
        ).toBeLessThan(THUMB_TOLERANCE);
        expect(
          Math.abs(side.thumbSize - side.viewHeight / side.contentHeight),
          pane,
        ).toBeLessThan(THUMB_TOLERANCE);
      }
      const [before, after] = sides as [
        (typeof sides)[number],
        (typeof sides)[number],
      ];
      expect(after.viewHeight, "matching frames").toBe(before.viewHeight);
      expect(after.contentHeight).toBe(before.contentHeight);
      expect(
        Math.abs(after.offset - before.offset),
        "visibly different places",
      ).toBeGreaterThanOrEqual(before.viewHeight / 4);
      expect(
        after.rows.map((top, index) => top - before.rows[index]!),
        "every section sits apart by the difference in offset",
      ).toEqual(after.rows.map(() => before.offset - after.offset));
    });

    test(`${where}: depicted screens keep their own ink inside a comparison`, async ({
      page,
    }) => {
      const stageInk = await paletteColor(scheme, "--chrome-ink-2");
      for (const route of [
        "design/changes/diff-controls/overlay-long",
        PANEL,
        APART,
      ]) {
        const preview = await open(page, route, viewport, scheme);
        const facts = await preview.evaluate((node) => ({
          sections: [...node.querySelectorAll(".mbk-shot-sections h3")].map(
            (heading) => [
              getComputedStyle(heading).color,
              getComputedStyle(heading.closest(".mbk-shot")!).color,
            ],
          ),
          stage: getComputedStyle(
            node.querySelector(".mbk-comparison-stage > h3")!,
          ).color,
        }));
        expect(facts.sections.length, route).toBeGreaterThan(0);
        for (const [heading, screen] of facts.sections)
          expect(heading, `${route}: the screen's ink`).toBe(screen);
        expect(facts.stage, `${route}: the stage heading`).toBe(stageInk);
      }
    });
  }
}
