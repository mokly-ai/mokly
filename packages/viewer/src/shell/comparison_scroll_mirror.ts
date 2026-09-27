/** One shared scroll offset mirrored across a comparison's viewports. */

/** A two-dimensional scroll offset in CSS pixels. */
export interface ScrollOffset {
  x: number;
  y: number;
}

/** A scroller whose offset can be read and set at once. */
export interface InstantScroller {
  scrollLeft: number;
  scrollTo(options: ScrollToOptions): void;
  scrollTop: number;
}

/** The scrollable element surface the mirror reads and writes. */
export type MirroredViewport = InstantScroller &
  Pick<HTMLElement, "addEventListener" | "removeEventListener">;

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

/**
 * Move a scroller at once. A plain `scrollTop` write follows the element's
 * CSS `scroll-behavior`, so a host or snapshot that asks for smooth scrolling
 * would animate it, and the read-back would not show the offset just written.
 */
export function scrollInstantly(
  scroller: InstantScroller,
  offset: ScrollOffset,
): void {
  if (scroller.scrollLeft === offset.x && scroller.scrollTop === offset.y)
    return;
  scroller.scrollTo({ behavior: "instant", left: offset.x, top: offset.y });
}

function write(viewport: MirroredViewport, offset: ScrollOffset): void {
  scrollInstantly(viewport, offset);
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
