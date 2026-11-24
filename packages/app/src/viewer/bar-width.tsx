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
 * The room that the full bar's centre leaves the end column, which the
 * centre's caps in the shared `viewer-bar.css` read: the package's search
 * with its whole placeholder, its key hint and the catalogue's tag picker,
 * then the end slot with History's label, or its glyph alone, Share and the
 * avatar. The search's key hint names `⌘K` on Apple platforms and `Ctrl K`
 * elsewhere, which is 23px wider, so each kind of platform has its own rooms.
 * A drawing's search draws `⌘K` and no tag picker, so a drawing's caps keep
 * the sheet's own rooms, and so does the cloud's own bar, which has no search
 * and whose last group is the drawings'.
 */
const endRooms = {
  apple: {
    "--fo-viewer-end-room": "21.8125rem",
    "--fo-viewer-end-room-glyphs": "18.125rem",
  },
  other: {
    "--fo-viewer-end-room": "23.25rem",
    "--fo-viewer-end-room-glyphs": "19.5625rem",
  },
} as const;

/**
 * Apple's platforms, as the package's search names its key hint for them: a
 * user agent that names a Mac, an iPhone, an iPad or an iPod.
 */
const appleAgent = /Mac|iPhone|iPad|iPod/u;

/** The end rooms of the platform that a user agent names. */
function platformRooms(userAgent: string) {
  return appleAgent.test(userAgent) ? endRooms.apple : endRooms.other;
}

/** What the bar's own width holds: its composition and its labels. */
interface BarWidth {
  /** Whether the bar draws its compact composition. */
  compact: boolean;
  /** Whether History draws its label beside its glyph. */
  labels: boolean;
}

/**
 * Choose the viewer top bar's composition and its labels from the width of
 * `root`, the app-owned `.fo-viewer-screen` element that the bar spans and
 * that the shared `viewer-bar.css` makes the bar's container. Its rules
 * decide: the full row when the five cloud controls fit beside the package's
 * own, or else the publication and More; and History's label when the full
 * row has room for it, or else its glyph alone. The returned probes are parts
 * that only the full bar and only the labelled drawings draw, hidden 1px
 * boxes beside `root`, so each has a box exactly when its rule holds.
 * Observing them also reports a change of the reader's text size, which no
 * change to the bar's own width does.
 *
 * The bar is compact until the first measurement, which runs before the first
 * paint, and it stays compact when the shared styles are missing, because an
 * unstyled probe has no width. `root` also carries the end rooms of the
 * reader's platform that the centre's caps read, which take the bar's width
 * from its container. Render the returned probes inside `root`.
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
    const rooms = platformRooms(window.navigator.userAgent);
    for (const [property, room] of Object.entries(rooms)) {
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
 * Whether History draws its label, or its glyph alone. It stays one control
 * that changes its drawing in place, so it keeps its focus.
 */
export function useBarLabels(): boolean {
  return useContext(BarWidthContext).labels;
}
