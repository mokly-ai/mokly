import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";

/**
 * The room that the full bar's centre leaves the end column, which the centre's
 * caps in the shared `viewer-bar.css` read: with the labels of History and
 * Settings, and with their glyphs alone. The App's end slot also holds
 * Settings, and its package search holds the catalogue's tag filter, so it
 * needs more than a drawing, whose caps keep their own: the package bar's
 * search with its whole placeholder and the end slot, and the last group of the
 * cloud's own bar.
 */
const endRooms = {
  "--fo-viewer-end-room": "25.875rem",
  "--fo-viewer-end-room-glyphs": "18.0625rem",
  "--fo-viewer-trail-room": "18.5rem",
  "--fo-viewer-trail-room-glyphs": "10.6875rem",
} as const;

/** What the bar's own width holds: its composition and its labels. */
interface BarWidth {
  /** Whether the bar draws its compact composition. */
  compact: boolean;
  /** Whether History and Settings draw their labels beside their glyphs. */
  labels: boolean;
}

/**
 * Choose the viewer top bar's composition and its labels from the width of
 * `root`, the app-owned `.fo-viewer-screen` element that the bar spans and
 * that the shared `viewer-bar.css` makes the bar's container. Its rules
 * decide: the full row when the six cloud controls fit beside the package's
 * own, or else the publication and More; and History's and Settings' labels
 * when the full row has room for them, or else their glyphs alone. The
 * returned probes are parts that only the full bar and only the labelled
 * drawings draw, hidden 1px boxes beside `root`, so each has a box exactly
 * when its rule holds. Observing them also reports a change of the reader's
 * text size, which no change to the bar's own width does.
 *
 * The bar is compact until the first measurement, which runs before the first
 * paint, and it stays compact when the shared styles are missing, because an
 * unstyled probe has no width. `root` also carries the end rooms that the
 * centre's caps read, which take the bar's width from its container. Render
 * the returned probes inside `root`.
 */
export function useViewerBarWidth(
  root: RefObject<HTMLElement | null>,
): BarWidth & { probe: ReactNode } {
  const full = useRef<HTMLSpanElement>(null);
  const labelled = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<BarWidth>({ compact: true, labels: true });
  useLayoutEffect(() => {
    const bar = root.current;
    const fullProbe = full.current;
    const labelProbe = labelled.current;
    if (bar === null || fullProbe === null || labelProbe === null) return;
    for (const [property, room] of Object.entries(endRooms)) {
      bar.style.setProperty(property, room);
    }
    const measure = () => {
      const compact = fullProbe.getBoundingClientRect().width <= 0;
      const labels = labelProbe.getBoundingClientRect().width > 0;
      setWidth((current) =>
        current.compact === compact && current.labels === labels
          ? current
          : { compact, labels },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(fullProbe);
    observer.observe(labelProbe);
    return () => observer.disconnect();
  }, [root]);
  return {
    ...width,
    probe: (
      <>
        <span
          aria-hidden="true"
          ref={full}
          className="fo-viewer-bar-probe fo-full-bar-only"
        />
        <span
          aria-hidden="true"
          ref={labelled}
          className="fo-viewer-bar-probe fo-bar-label-only"
        />
      </>
    ),
  };
}

/** Without a measured width the bar is compact, which fits every width. */
const BarWidthContext = createContext<BarWidth>({
  compact: true,
  labels: true,
});

/** Give the bar beneath the composition and the labels its width chose. */
export function CompactBarProvider({
  compact,
  labels,
  children,
}: BarWidth & { children: ReactNode }) {
  const value = useMemo(() => ({ compact, labels }), [compact, labels]);
  return (
    <BarWidthContext.Provider value={value}>
      {children}
    </BarWidthContext.Provider>
  );
}

/**
 * Whether the viewer's top bar draws its compact composition. The fallback
 * bar and both package slots read it through the bar's placement, and their
 * triggers for their labels, so they always agree.
 */
export function useCompactBar(): boolean {
  return useContext(BarWidthContext).compact;
}

/**
 * Whether History and Settings draw their labels, or their glyphs alone. Each
 * stays one control that changes its drawing in place, so it keeps its focus.
 */
export function useBarLabels(): boolean {
  return useContext(BarWidthContext).labels;
}
