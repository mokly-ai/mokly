import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";

/**
 * What each full-bar slot gives up for the package's 22rem: little from the
 * start slot, for a pull request's author, Changes and GitHub beside its
 * trigger, and most from the end slot, whose account label truncates first.
 * A static catalogue frame sets neither, so its caps keep their own reserve.
 */
const slotReserves = {
  "--fo-viewer-start-reserve": "3rem",
  "--fo-viewer-end-reserve": "19rem",
} as const;

/** The measured bar width, which the slot caps in `viewer.css` read. */
const barWidthProperty = "--fo-viewer-bar-width";

/**
 * Choose the viewer top bar's composition from the width of `root`, the
 * app-owned `.fo-viewer-screen` element that the bar spans and that the shared
 * `viewer.css` makes the bar's container. Its one switch rule decides: the
 * full row when the six cloud controls fit beside the package's own, or else
 * the publication and More. The returned probe is a part that only the full
 * bar draws, a hidden 1px box beside `root`, so it has a box exactly when the
 * rule holds the full row. Observing it also reports a change of the reader's
 * text size, which no change to the bar's own width does.
 *
 * The bar is compact until the first measurement, which runs before the first
 * paint, and it stays compact when the shared styles are missing, because an
 * unstyled probe has no width. `root` also carries the bar width and the slot
 * reserves that the slot caps read. Render the returned probe inside `root`.
 */
export function useViewerBarWidth(root: RefObject<HTMLElement | null>): {
  compact: boolean;
  probe: ReactNode;
} {
  const probe = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(true);
  useLayoutEffect(() => {
    const bar = root.current;
    const full = probe.current;
    if (bar === null || full === null) return;
    for (const [property, reserve] of Object.entries(slotReserves)) {
      bar.style.setProperty(property, reserve);
    }
    const measure = () => {
      const width = bar.getBoundingClientRect().width;
      bar.style.setProperty(barWidthProperty, width + "px");
      setCompact(full.getBoundingClientRect().width <= 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(full);
    return () => observer.disconnect();
  }, [root]);
  return {
    compact,
    probe: (
      <span
        aria-hidden="true"
        ref={probe}
        className="fo-viewer-bar-probe fo-full-bar-only"
      />
    ),
  };
}

/** Without a measured width the bar is compact, which fits every width. */
const CompactBarContext = createContext(true);

/** Give the bar beneath the composition that its measured width chose. */
export function CompactBarProvider({
  compact,
  children,
}: {
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <CompactBarContext.Provider value={compact}>
      {children}
    </CompactBarContext.Provider>
  );
}

/**
 * Whether the viewer's top bar draws its compact composition. The fallback
 * bar and both package slots read it through the bar's placement, and their
 * triggers for their labels, so they always agree.
 */
export function useCompactBar(): boolean {
  return useContext(CompactBarContext);
}
