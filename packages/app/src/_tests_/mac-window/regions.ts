import type { Locator, Page } from "@playwright/test";

import { expect } from "../harness";

/**
 * The computed property that Electron reads to find the parts of the page that
 * move the window. A browser ignores it, but Chromium still computes it, and
 * `toHaveCSS` reads it through `getComputedStyle`, so a browser test reads what
 * the Mac app's window does at an element that sets it: `drag` moves the
 * window, `no-drag` takes the click. `regionAt` reads a point.
 */
const appRegion = "-webkit-app-region";

/** The width of the window buttons that the Mac drawings use. */
const macButtonsWidth = 86;

/** The window edge that holds the buttons: the start, or the end in a right-to-left locale. */
export type WindowEdge = "start" | "end";

const insetProperty = {
  start: "--fo-window-inset",
  end: "--fo-window-inset-end",
} as const satisfies Record<WindowEdge, string>;

/** Each control that a bar draws: its pressables and its links. */
function barControls(bar: Locator): Locator {
  return bar.getByRole("button").or(bar.getByRole("link"));
}

/** The part moves the Mac app's window from wherever it has no control. */
export async function expectMovesWindow(part: Locator, label: string) {
  await expect(part, `${label} moves the window`).toHaveCSS(appRegion, "drag");
}

/** A control or an overlay surface takes the click instead. */
export async function expectTakesClicks(element: Locator, label: string) {
  await expect(element, `${label} takes clicks`).toHaveCSS(
    appRegion,
    "no-drag",
  );
}

/** Something covers the part, so the part stops moving the window. */
export async function expectStopsMovingWindow(part: Locator, label: string) {
  await expect(part, `${label} stops moving the window`).toHaveCSS(
    appRegion,
    "no-drag",
  );
}

/**
 * The bar moves the window, and every control in it takes clicks. The bar
 * must draw a control, so that the second check cannot pass on none.
 */
export async function expectBarRegions(bar: Locator, label: string) {
  await expectMovesWindow(bar, label);
  const controls = barControls(bar);
  await expect(controls, `${label} draws its controls`).not.toHaveCount(0);
  await expect
    .poll(
      () =>
        controls.evaluateAll(
          (elements, property) =>
            elements
              .filter(
                (element) =>
                  getComputedStyle(element).getPropertyValue(property) !==
                  "no-drag",
              )
              .map(
                (element) =>
                  element.getAttribute("aria-label") ||
                  element.textContent?.trim() ||
                  element.tagName,
              ),
          appRegion,
        ),
      `every control in ${label} takes clicks`,
    )
    .toEqual([]);
}

/**
 * What the Mac app's window does at one point, as Electron collects the
 * page's regions: the region of the last element in document order whose box
 * holds the point and that has `drag` or `no-drag`, else `none`. The shell's
 * Chromium passes a region down to each element that sets none, and the
 * browser suite's Chromium does not, so an element here takes the region of
 * its nearest element, itself or an ancestor, that sets one.
 */
export function regionAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([pointX, pointY, property]) => {
      let region = "none";
      for (const element of document.querySelectorAll("*")) {
        let value = "";
        for (
          let node: Element | null = element;
          node;
          node = node.parentElement
        ) {
          value = getComputedStyle(node).getPropertyValue(property);
          if (value === "drag" || value === "no-drag") break;
        }
        if (value !== "drag" && value !== "no-drag") continue;
        const box = element.getBoundingClientRect();
        if (
          pointX >= box.left &&
          pointX < box.right &&
          pointY >= box.top &&
          pointY < box.bottom
        )
          region = value;
      }
      return region;
    },
    [x, y, appRegion] as const,
  );
}

/**
 * The part takes clicks at every point of its box in the Mac app's window,
 * so no press on it moves the window: one pixel inside each edge, where its
 * hairline is, and at its middle.
 */
export async function expectTakesClicksThroughout(
  page: Page,
  part: Locator,
  label: string,
) {
  const box = await part.boundingBox();
  expect(box, `${label} is drawn`).not.toBeNull();
  if (box === null) return;
  const { x, y, width, height } = box;
  for (const [where, pointX, pointY] of [
    ["start edge", x + 0.5, y + height / 2],
    ["end edge", x + width - 0.5, y + height / 2],
    ["top edge", x + width / 2, y + 0.5],
    ["bottom edge", x + width / 2, y + height - 0.5],
    ["middle", x + width / 2, y + height / 2],
  ] as const)
    await expect
      .poll(
        () => regionAt(page, pointX, pointY),
        `${label} takes clicks at its ${where}`,
      )
      .toBe("no-drag");
}

/**
 * What the page draws in the free space after a part, inside the slot that
 * holds it: the space's width, and the region at its middle, which says
 * whether that space moves the Mac window.
 */
export async function spaceAfter(
  page: Page,
  part: Locator,
  slot: Locator,
): Promise<{ width: number; region: string }> {
  const [box, room] = await Promise.all([
    part.boundingBox(),
    slot.boundingBox(),
  ]);
  if (box === null || room === null) return { width: 0, region: "missing" };
  const start = box.x + box.width;
  const width = room.x + room.width - start;
  const region = await regionAt(
    page,
    start + width / 2,
    box.y + box.height / 2,
  );
  return { width, region };
}

/**
 * Report the window buttons at one edge, as the Mac app does through the
 * window controls overlay. A browser has no overlay, so the test sets the
 * width on the root element, where the shared stylesheet reads it.
 */
export async function emulateMacWindow(page: Page, edge: WindowEdge) {
  await page.evaluate(
    ([property, width]) => {
      document.documentElement.style.setProperty(property, `${width}px`);
    },
    [insetProperty[edge], macButtonsWidth] as const,
  );
}

/**
 * Report the window buttons at one edge from the first script of each page
 * on, as the Mac app does, so that the app starts its check of the drag areas.
 * The script sets the width once the document has a root element, before the
 * app's scripts run. The catalogue's frames report no buttons.
 */
export async function emulateMacWindowAtStart(page: Page, edge: WindowEdge) {
  await page.addInitScript(
    ([property, width]) => {
      if (window !== window.top) return;
      const report = () =>
        document.documentElement.style.setProperty(property, `${width}px`);
      if (document.documentElement) {
        report();
        return;
      }
      new MutationObserver((_, observer) => {
        if (!document.documentElement) return;
        report();
        observer.disconnect();
      }).observe(document, { childList: true });
    },
    [insetProperty[edge], macButtonsWidth] as const,
  );
}

/** Report no window buttons again, as a browser does. */
export async function clearMacWindow(page: Page) {
  await page.evaluate((properties) => {
    for (const property of properties) {
      document.documentElement.style.removeProperty(property);
    }
  }, Object.values(insetProperty));
}

/** Where a bar's parts reach into the buttons at one edge of the window. */
export async function partsUnderButtons(
  bar: Locator,
  edge: WindowEdge,
): Promise<string[]> {
  return bar.evaluate(
    (element, [side, width]) => {
      const reach: string[] = [];
      for (const part of element.children) {
        const box = part.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const name =
          part.textContent?.trim() ||
          part.getAttribute("class") ||
          part.tagName;
        if (side === "start" && box.left < width - 0.5) {
          reach.push(`${name} starts at ${box.left}px`);
        }
        if (side === "end" && box.right > window.innerWidth - width + 0.5) {
          reach.push(`${name} ends at ${box.right}px`);
        }
      }
      return reach;
    },
    [edge, macButtonsWidth] as const,
  );
}

/**
 * Each bar keeps its parts clear of the window buttons, with the buttons at
 * the start of the window and then at its end.
 */
export async function expectBarsClearOfButtons(
  page: Page,
  bars: Readonly<Record<string, Locator>>,
) {
  for (const edge of ["start", "end"] as const) {
    await emulateMacWindow(page, edge);
    for (const [label, bar] of Object.entries(bars)) {
      await expect
        .poll(
          () => partsUnderButtons(bar, edge),
          `${label} keeps clear of the buttons at the ${edge}`,
        )
        .toEqual([]);
    }
    await clearMacWindow(page);
  }
}

/**
 * The two window insets as lengths. A custom property keeps the tokens it was
 * given, `calc()` among them, so the page resolves each one through the
 * margin of a probe that it removes again. A margin keeps a negative length.
 */
export function windowInsets(page: Page): Promise<Record<WindowEdge, string>> {
  return page.evaluate((properties) => {
    const resolve = (property: string) => {
      const probe = document.createElement("div");
      probe.style.marginLeft = `var(${property})`;
      document.body.append(probe);
      const length = getComputedStyle(probe).marginLeft;
      probe.remove();
      return length;
    };
    return { start: resolve(properties.start), end: resolve(properties.end) };
  }, insetProperty);
}
