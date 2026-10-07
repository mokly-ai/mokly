import { expect, type Locator, type Page } from "@playwright/test";

import {
  paneFrame,
  paneFrameSelector,
  type Offset,
  type Side,
} from "./comparison_alignment_helpers.js";

/**
 * The selector of one region in each version, or one selector for both. Use
 * plain CSS that `querySelectorAll` accepts: `regionOffsets` waits through
 * Playwright's selector engine but reads inside the page, and only plain CSS
 * outside shadow roots matches the same element in both.
 */
export type RegionSelector = string | Record<Side, string>;

function selectorFor(selector: RegionSelector, side: Side): string {
  return typeof selector === "string" ? selector : selector[side];
}

/** Read one region's scroll offset inside a pane frame. */
export function regionOffset(
  frame: Locator,
  selector: string,
): Promise<Offset> {
  return frame
    .contentFrame()
    .locator(selector)
    .evaluate((node) => ({ x: node.scrollLeft, y: node.scrollTop }));
}

/**
 * Read one region's offsets in both versions of a section, once both exist,
 * in one task of the page, so both describe one rendering update. Reads taken
 * apart may see two frames of a scroll the browser animates, or by chance
 * one, which would make every check that compares versions depend on timing.
 * The offsets may still be moving: a step that starts from an offset gets it
 * from `expectRegionsAtRest`. Both panes must be same-origin documents.
 */
export async function regionOffsets(
  section: Locator,
  selector: RegionSelector,
): Promise<Record<Side, Offset>> {
  const regions = {
    after: selectorFor(selector, "after"),
    before: selectorFor(selector, "before"),
  };
  for (const side of ["before", "after"] as const)
    await paneFrame(section, side)
      .contentFrame()
      .locator(regions[side])
      .waitFor({ state: "attached" });
  const frames = {
    after: paneFrameSelector("after"),
    before: paneFrameSelector("before"),
  };
  return section.evaluate(
    (element, query) => {
      const only = (scope: ParentNode, css: string) => {
        const found = scope.querySelectorAll(css);
        if (found.length !== 1)
          throw new Error(`Expected one ${css}, found ${found.length}`);
        return found[0]!;
      };
      const read = (side: Side): Offset => {
        const frame = only(element, query.frames[side]) as HTMLIFrameElement;
        const pane = frame.contentDocument;
        if (!pane)
          throw new Error(
            `Cannot read the ${side} pane document; region helpers need a same-origin pane`,
          );
        const region = only(pane, query.regions[side]);
        return { x: region.scrollLeft, y: region.scrollTop };
      };
      return { before: read("before"), after: read("after") };
    },
    { frames, regions },
  );
}

/** Expect a region's vertical offsets, `[before, after]`, to settle. */
export async function expectRegionsAt(
  section: Locator,
  selector: RegionSelector,
  expected: [number, number],
  axis: keyof Offset = "y",
): Promise<void> {
  await expect
    .poll(async () => {
      const offsets = await regionOffsets(section, selector);
      return [offsets.before[axis], offsets.after[axis]];
    })
    .toEqual(expected);
}

/**
 * Wait until both versions of a region agree on an offset that `accept`
 * allows and keep it while a few rendering updates pass, then return it. The
 * browser may animate a region scroll and every version follows each frame,
 * so only an offset at rest is a safe start for a next step.
 */
export async function expectRegionsAtRest(
  section: Locator,
  selector: RegionSelector,
  accept: (offset: number) => boolean,
  axis: keyof Offset = "y",
  message?: string,
): Promise<number> {
  let reached = 0;
  await expect
    .poll(async () => {
      const offsets = await regionOffsets(section, selector);
      reached = offsets.after[axis];
      if (offsets.before[axis] !== reached || !accept(reached)) return false;
      await passRenderingUpdates(section.page());
      const later = await regionOffsets(section, selector);
      return later.before[axis] === reached && later.after[axis] === reached;
    }, message)
    .toBe(true);
  return reached;
}

/** Expect both versions of a region to rest at one non-zero offset, returning it. */
export function expectRegionsTogether(
  section: Locator,
  selector: RegionSelector,
  axis: keyof Offset = "y",
): Promise<number> {
  return expectRegionsAtRest(section, selector, (offset) => offset !== 0, axis);
}

/**
 * Wheel over the centre of one region inside a pane frame, first scrolling
 * the comparison stage so the region's centre is well inside the stage.
 */
export async function wheelOverRegion(
  page: Page,
  frame: Locator,
  selector: string,
  deltaY: number,
  deltaX = 0,
): Promise<void> {
  const region = frame.contentFrame().locator(selector);
  const stage = (await page.locator("[data-diff-stage]").boundingBox())!;
  let box = await region.boundingBox();
  if (!box) throw new Error(`The region ${selector} is not rendered`);
  const centre = box.y + box.height / 2;
  if (centre < stage.y + 40 || centre > stage.y + stage.height - 40) {
    await frame.evaluate(
      (element, delta) =>
        element.closest("[data-diff-stage]")?.scrollBy(0, delta),
      centre - (stage.y + stage.height / 2),
    );
    box = (await region.boundingBox())!;
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, deltaY);
}

/** Scroll a region the way the browser would on its own, such as find. */
export function scrollRegion(
  frame: Locator,
  selector: string,
  offset: Partial<Offset>,
): Promise<void> {
  return frame
    .contentFrame()
    .locator(selector)
    .evaluate((node, to) => {
      node.scrollTo({
        behavior: "instant",
        ...(to.x === undefined ? {} : { left: to.x }),
        ...(to.y === undefined ? {} : { top: to.y }),
      });
    }, offset);
}

/** Let a few rendering updates of the page pass. */
export async function passRenderingUpdates(page: Page): Promise<void> {
  for (let frames = 0; frames < 3; frames += 1)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
}

/**
 * Wait until a region reaches an offset, then let a few rendering updates
 * pass, so any scroll event it still owes has run before a caller asserts that
 * another region did not follow.
 */
export async function settleRegion(
  page: Page,
  frame: Locator,
  selector: string,
  expected: Partial<Offset>,
): Promise<void> {
  await expect
    .poll(async () => {
      const offset = await regionOffset(frame, selector);
      return (
        (expected.x === undefined || offset.x === expected.x) &&
        (expected.y === undefined || offset.y === expected.y)
      );
    })
    .toBe(true);
  await passRenderingUpdates(page);
}

/** Every error the shell page raises while a test runs. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** The Scroll together switch of the comparison band. */
export function scrollTogether(page: Page): Locator {
  return page.getByRole("switch", { name: "Scroll together" });
}

/** Mark every pane document so a later check can prove none reloaded. */
export async function markPaneDocuments(section: Locator): Promise<void> {
  for (const frame of await section.locator("iframe").all())
    await frame.evaluate((element: HTMLIFrameElement) => {
      element.contentDocument!.documentElement.dataset["probe"] = "kept";
    });
}

/** Expect every pane document marked earlier to be the same document. */
export async function expectPaneDocumentsKept(section: Locator): Promise<void> {
  for (const frame of await section.locator("iframe").all())
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) =>
          element.contentDocument?.documentElement.dataset["probe"],
      ),
    ).toBe("kept");
}
