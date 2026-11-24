/**
 * The view of one canvas: the stage that its box measures, the section's
 * zoom and position, and the commands of its handle. A section opens fitted
 * and refits while it stays fitted, when the stage changes size or the
 * section's lengths change; after the reader pans or zooms, the view stays
 * until the next Fit.
 */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  readingSize,
  sectionExtent,
  type CanvasCell,
  type CanvasSectionKind,
  type CanvasSize,
} from "../canvas-section/section-layout.js";

import type { CanvasCommand } from "./canvas-keys.js";
import {
  fitView,
  stageCentre,
  stepZoom,
  zoomAbout,
  type CanvasExtent,
  type CanvasRect,
  type CanvasView,
  type FitAlign,
} from "./canvas-view.js";

/** What the host can ask of the canvas, such as from its keys or a dock. */
export interface CanvasStageHandle {
  /** Refit the stage, as the pill's Fit and Shift+1 do. */
  fit(): void;
  /** Run the command of a key, from `canvasKeyCommand`. */
  run(command: CanvasCommand): void;
  /** Zoom in one step about the stage's centre. */
  zoomIn(): void;
  /** Zoom out one step about the stage's centre. */
  zoomOut(): void;
  /** Show a zoom about the stage's centre, such as 1 for 100%. */
  zoomTo(zoom: number): void;
  /**
   * Multiply the zoom by a factor about a point of the page, in CSS pixels
   * from the viewport's top left, so the point stays in its place, as a
   * wheel or a pinch that a frame's document forwards does.
   */
  zoomAt(factor: number, clientX: number, clientY: number): void;
}

/** A change of the view, from the shown section's extent and the stage. */
export type CanvasViewChange = (
  view: CanvasView,
  extent: CanvasExtent,
  stage: CanvasRect,
) => CanvasView;

/** The view before the stage is measured; the first measurement fits it. */
const UNMEASURED: CanvasView = { fitted: true, x: 0, y: 0, zoom: 1 };

function measured(stage: CanvasRect | undefined): stage is CanvasRect {
  return stage !== undefined && stage.width > 0 && stage.height > 0;
}

function sameRect(first: CanvasRect | undefined, second: CanvasRect): boolean {
  return (
    first !== undefined &&
    first.left === second.left &&
    first.top === second.top &&
    first.width === second.width &&
    first.height === second.height
  );
}

/**
 * The stage that a box covers, kept while it resizes. A change of the
 * canvas's insets resizes the box, so it refits like a change of the
 * canvas.
 */
function useStage(box: RefObject<HTMLDivElement | null>) {
  const [stage, setStage] = useState<CanvasRect>();
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      const next = {
        height: element.clientHeight,
        left: element.offsetLeft,
        top: element.offsetTop,
        width: element.clientWidth,
      };
      setStage((current) => (sameRect(current, next) ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);
  return stage;
}

/**
 * The handle's zoom about a point of the page, which a host forwards from a
 * frame's document, where the canvas's own gestures cannot reach. The stage
 * box's parent is the canvas, whose box places the point on it.
 */
function pointZoom(
  change: (next: CanvasViewChange) => void,
  box: RefObject<HTMLDivElement | null>,
): Pick<CanvasStageHandle, "zoomAt"> {
  return {
    zoomAt: (factor, clientX, clientY) => {
      const canvas = box.current?.parentElement;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const point = { x: clientX - bounds.left, y: clientY - bounds.top };
      change((view, extent) =>
        zoomAbout(view, extent, view.zoom * factor, point),
      );
    },
  };
}

/**
 * The handle's commands over one change function, with Fit's placement of
 * the shown section, less its point zoom.
 */
function commands(
  change: (next: CanvasViewChange) => void,
  align: () => FitAlign,
): Omit<CanvasStageHandle, "zoomAt"> {
  const zoomTo = (zoom: number) =>
    change((view, extent, stage) =>
      zoomAbout(view, extent, zoom, stageCentre(stage)),
    );
  const fit = () =>
    change((_view, extent, stage) => fitView(extent, stage, align()));
  const zoomIn = () =>
    change((view, extent, stage) => stepZoom(view, extent, stage, "in"));
  const zoomOut = () =>
    change((view, extent, stage) => stepZoom(view, extent, stage, "out"));
  return {
    fit,
    run: (command) => {
      if (command === "fit") fit();
      else if (command === "actual-size") zoomTo(1);
      else if (command === "zoom-in") zoomIn();
      else zoomOut();
    },
    zoomIn,
    zoomOut,
    zoomTo,
  };
}

/** The view of a canvas whose stage `box` covers, for the shown section. */
export function useCanvasView(
  box: RefObject<HTMLDivElement | null>,
  section:
    | {
        compact?: boolean | undefined;
        frames: readonly CanvasCell[];
        kind: CanvasSectionKind;
      }
    | undefined,
  fitKey: string,
): {
  change(next: CanvasViewChange): void;
  handle: CanvasStageHandle;
  reading: CanvasSize;
  view: CanvasView;
} {
  const stage = useStage(box);
  const [view, setView] = useState(UNMEASURED);
  const compact = section?.compact ?? false;
  const reading = useMemo(
    () => readingSize(stage ?? { height: 0, width: 0 }, compact),
    [compact, stage],
  );
  const computed = section
    ? sectionExtent(section.kind, section.frames, reading, compact)
    : undefined;
  // The extent keeps its identity while its value stays the same, so a
  // host's render that changes no length refits nothing.
  const extentKey = computed ? JSON.stringify(computed) : "";
  const extent = useMemo(() => computed, [extentKey]);
  const latest = useRef<{ extent?: CanvasExtent; stage?: CanvasRect }>({});
  latest.current = {
    ...(extent ? { extent } : {}),
    ...(stage ? { stage } : {}),
  };

  // The compact layout stands its section at the stage's top.
  const align: FitAlign = compact ? "start" : "centre";
  const alignment = useRef(align);
  alignment.current = align;

  const fittedKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!extent || !measured(stage)) return;
    const opened = fittedKey.current !== fitKey;
    fittedKey.current = fitKey;
    setView((current) =>
      opened || current.fitted ? fitView(extent, stage, align) : current,
    );
  }, [align, extent, fitKey, stage]);

  const change = useCallback((next: CanvasViewChange) => {
    const { extent: shown, stage: room } = latest.current;
    if (!shown || !measured(room)) return;
    setView((current) => next(current, shown, room));
  }, []);
  const handle = useMemo(
    () => ({
      ...commands(change, () => alignment.current),
      ...pointZoom(change, box),
    }),
    [box, change],
  );
  return { change, handle, reading, view };
}
