/** One shared scroll offset mirrored across a comparison's viewports. */

/** A two-dimensional scroll offset in CSS pixels. */
export interface ScrollOffset {
  x: number;
  y: number;
}

/** The scrollable element surface the mirror reads and writes. */
export type MirroredViewport = Pick<
  HTMLElement,
  "addEventListener" | "removeEventListener" | "scrollLeft" | "scrollTop"
>;

/** Viewports that always show one offset, whichever the reader scrolls. */
export interface ScrollMirror {
  /** Mirror a viewport; the first one defines the offset, later ones adopt it. */
  add(viewport: MirroredViewport): () => void;
  /** Move every viewport to a target, returning the offset they settle on. */
  moveTo(target: ScrollOffset): ScrollOffset;
  /** The offset every mirrored viewport shows. */
  offset(): ScrollOffset;
}

function read(viewport: MirroredViewport): ScrollOffset {
  return { x: viewport.scrollLeft, y: viewport.scrollTop };
}

function same(first: ScrollOffset, second: ScrollOffset): boolean {
  return first.x === second.x && first.y === second.y;
}

function write(viewport: MirroredViewport, offset: ScrollOffset): void {
  if (viewport.scrollLeft !== offset.x) viewport.scrollLeft = offset.x;
  if (viewport.scrollTop !== offset.y) viewport.scrollTop = offset.y;
}

/**
 * Mirror scroll offsets between viewports. A scroll event whose viewport
 * already shows the shared offset is the echo of a write made here and is
 * ignored, so writes never recurse; no timer is involved. `changed` hears
 * every new offset a reader scrolls to.
 */
export function createScrollMirror(
  changed: (offset: ScrollOffset) => void,
): ScrollMirror {
  const viewports = new Set<MirroredViewport>();
  let current: ScrollOffset = { x: 0, y: 0 };
  const scrolled = (source: MirroredViewport): void => {
    const next = read(source);
    if (same(next, current)) return;
    current = next;
    for (const viewport of viewports)
      if (viewport !== source) write(viewport, next);
    changed(next);
  };
  return {
    add(viewport) {
      if (viewports.size === 0) current = read(viewport);
      else write(viewport, current);
      viewports.add(viewport);
      const listener = () => scrolled(viewport);
      viewport.addEventListener("scroll", listener, { passive: true });
      return () => {
        viewport.removeEventListener("scroll", listener);
        viewports.delete(viewport);
      };
    },
    moveTo(target) {
      let settled = target;
      for (const viewport of viewports) {
        write(viewport, settled);
        settled = read(viewport);
      }
      for (const viewport of viewports)
        if (!same(read(viewport), settled)) write(viewport, settled);
      current = settled;
      return current;
    },
    offset: () => current,
  };
}
