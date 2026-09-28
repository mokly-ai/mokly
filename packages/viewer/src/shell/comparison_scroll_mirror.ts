/** The page offsets of a comparison section's viewports, linked or apart. */

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

/**
 * Viewports that show one offset while linked, whichever the reader scrolls,
 * and keep their own offsets while apart.
 */
export interface ScrollMirror {
  /** Mirror a viewport; while linked, it adopts the offset the others show. */
  add(viewport: MirroredViewport): () => void;
  /** Link or unlink the viewports; linking moves every other one to `from`. */
  link(linked: boolean, from?: MirroredViewport): void;
  /** Move a viewport, and every viewport while linked, towards a target. */
  moveTo(viewport: MirroredViewport, target: ScrollOffset): ScrollOffset;
  /** The offset a viewport shows. */
  offset(viewport: MirroredViewport): ScrollOffset;
  /** Settle every viewport at its offset again after its range changed. */
  resettle(): void;
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

/**
 * Mirror scroll offsets between viewports. Each viewport records the offset
 * it last settled on; a scroll event reporting exactly that offset is the
 * echo of a write made here and is ignored, so writes never recurse and no
 * timer is involved. `changed` hears every new offset a reader scrolls to.
 */
export function createScrollMirror(
  changed: (viewport: MirroredViewport, offset: ScrollOffset) => void,
  linked = true,
): ScrollMirror {
  const offsets = new Map<MirroredViewport, ScrollOffset>();
  let joined = linked;

  function settle(
    viewports: readonly MirroredViewport[],
    target: ScrollOffset,
  ): void {
    let settled = target;
    for (const viewport of viewports) {
      scrollInstantly(viewport, settled);
      settled = read(viewport);
    }
    for (const viewport of viewports) {
      if (!same(read(viewport), settled)) scrollInstantly(viewport, settled);
      offsets.set(viewport, read(viewport));
    }
  }

  const scrolled = (source: MirroredViewport): void => {
    const next = read(source);
    const last = offsets.get(source);
    if (!last || same(next, last)) return;
    offsets.set(source, next);
    if (joined)
      for (const viewport of offsets.keys())
        if (viewport !== source) {
          scrollInstantly(viewport, next);
          offsets.set(viewport, read(viewport));
        }
    changed(source, next);
  };

  const first = () => offsets.keys().next().value;

  return {
    add(viewport) {
      const leader = first();
      if (joined && leader) scrollInstantly(viewport, offsets.get(leader)!);
      offsets.set(viewport, read(viewport));
      const listener = () => scrolled(viewport);
      viewport.addEventListener("scroll", listener, { passive: true });
      return () => {
        viewport.removeEventListener("scroll", listener);
        offsets.delete(viewport);
      };
    },
    link(linked, from) {
      joined = linked;
      const target = from && offsets.get(from);
      if (!joined || !from || !target) return;
      const others = [...offsets.keys()].filter(
        (viewport) => viewport !== from,
      );
      settle([from, ...others], target);
    },
    moveTo(viewport, target) {
      if (!offsets.has(viewport)) {
        scrollInstantly(viewport, target);
        return read(viewport);
      }
      settle(joined ? [...offsets.keys()] : [viewport], target);
      return offsets.get(viewport)!;
    },
    offset: (viewport) => offsets.get(viewport) ?? read(viewport),
    resettle() {
      const leader = first();
      if (joined) {
        if (leader) settle([...offsets.keys()], offsets.get(leader)!);
        return;
      }
      for (const [viewport, offset] of [...offsets]) settle([viewport], offset);
    },
  };
}
