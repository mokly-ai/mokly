/**
 * The canvas: a full-bleed dot grid that holds the selected entry's section,
 * with the zoom pill at the bottom centre of its stage. It keeps the view,
 * the zoom and the position of the section, itself: an entry opens fitted,
 * and the reader pans and zooms with the pointer, the wheel, a pinch and the
 * pill. A host reaches Fit and the zoom steps through the handle that `ref`
 * receives, such as from its keys, and hears of each change of the view.
 */

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type Ref,
} from "react";

import { CanvasSection } from "../canvas-section/canvas-section.js";
import { CanvasZoomPill } from "../canvas-zoom-pill/canvas-zoom-pill.js";
import { useMergedRef } from "../merged-ref/merged-ref.js";

import { bindCanvasGestures } from "./canvas-gestures.js";
import {
  drawnPosition,
  panView,
  wheelZoom,
  zoomAbout,
  type CanvasView,
} from "./canvas-view.js";
import { useCanvasView, type CanvasStageHandle } from "./use-canvas-view.js";

export { canvasKeyCommand, type CanvasCommand } from "./canvas-keys.js";
export { wheelPixels } from "./canvas-gestures.js";
export type { CanvasKeyEvent } from "./canvas-keys.js";
export {
  wheelZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  type CanvasExtent,
  type CanvasRect,
  type CanvasView,
} from "./canvas-view.js";
export type { CanvasStageHandle } from "./use-canvas-view.js";

/** The section that the canvas holds: a `CanvasSection` less its reading size. */
export type CanvasStageSection = Omit<
  ComponentProps<typeof CanvasSection>,
  "reading"
>;

/** The pitch of the dot grid, which moves with the section when it pans. */
const GRID_PITCH = 24;

/**
 * The smallest zoom at which the canvas shows the fixed-size tags on its
 * frames, such as a highlight's labels and the selection's name and size
 * tags. Below it, a tag would cover more of a frame than it names, so the
 * tags hide; the marks that they name stay.
 */
export const CANVAS_TAG_ZOOM = 0.6;

/**
 * Whether the fixed-size tags on a frame show at a frame's scale, which
 * counts in whole percent as the zoom pill shows it, so a pill that reads
 * 60% shows the tags.
 */
export function canvasTagsShown(scale: number): boolean {
  return Math.round(scale * 100) >= Math.round(CANVAS_TAG_ZOOM * 100);
}

/** Whether a press on a target belongs to a control, not to the canvas. */
function onControl(target: EventTarget | null): boolean {
  return (
    target !== null &&
    "closest" in target &&
    (target as Element).closest(
      "a, button, input, label, select, summary, textarea, [contenteditable]",
    ) !== null
  );
}

/** Whether a click lands on the empty canvas: on no frame and no control. */
function onEmptyCanvas(target: EventTarget | null): boolean {
  return (
    target !== null &&
    "closest" in target &&
    !onControl(target) &&
    (target as Element).closest(".mbk-canvas-frame, .mbk-canvas-pill") === null
  );
}

export function CanvasStage({
  canvasRef,
  fitKey = "",
  onEmptyClick,
  onViewChange,
  ref,
  routed = false,
  section,
  stageRef,
}: {
  /** Receives the canvas, which clips the frames and their highlights. */
  canvasRef?: Ref<HTMLDivElement> | undefined;
  /**
   * Names the shown section. A new name fits the stage again, as when
   * another entry opens or the shown frames change.
   */
  fitKey?: string | undefined;
  /**
   * Hears of each click on the empty canvas, around the frames and away
   * from every control, that no drag made, such as to clear a selection.
   */
  onEmptyClick?: (() => void) | undefined;
  /** Hears of each pan, zoom and Fit, such as to measure frames again. */
  onViewChange?: ((view: CanvasView) => void) | undefined;
  /** Receives the handle with Fit and the zoom steps. */
  ref?: Ref<CanvasStageHandle> | undefined;
  /** Whether it is the routed entry's stage, which a host finds by `data-mokly-stage`. */
  routed?: boolean;
  /** The section on the canvas. Without one, the canvas shows no zoom pill. */
  section?: CanvasStageSection | undefined;
  /**
   * Receives the stage's invisible box: the canvas between the floating
   * panels and above the zoom pill, to which a host clips its markers.
   */
  stageRef?: Ref<HTMLDivElement> | undefined;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const stageBox = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const { change, handle, reading, view } = useCanvasView(
    stageBox,
    section,
    fitKey,
  );
  useImperativeHandle(ref, () => handle, [handle]);

  const viewChange = useRef(onViewChange);
  viewChange.current = onViewChange;
  useEffect(() => {
    viewChange.current?.(view);
  }, [view]);

  // A drag swallows the click that its release makes, so a click that
  // reaches the canvas is a press without movement.
  const emptyClick = useRef(onEmptyClick);
  emptyClick.current = onEmptyClick;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const click = (event: MouseEvent) => {
      if (!event.defaultPrevented && onEmptyCanvas(event.target))
        emptyClick.current?.();
    };
    element.addEventListener("click", click);
    return () => element.removeEventListener("click", click);
  }, []);

  const holds = section !== undefined;
  useEffect(() => {
    const element = canvas.current;
    if (!element || !holds) return;
    return bindCanvasGestures(element, () => ({
      ignores: (target) =>
        onControl(target) ||
        (target instanceof Node && pill.current?.contains(target) === true),
      pan: (dx, dy) => change((current) => panView(current, dx, dy)),
      panning: setPanning,
      zoomBy: (factor, point) =>
        change((current, extent) =>
          zoomAbout(current, extent, current.zoom * factor, point),
        ),
      zoomWheel: (deltaY, point) =>
        change((current, extent) =>
          zoomAbout(current, extent, wheelZoom(current.zoom, deltaY), point),
        ),
    }));
  }, [change, holds]);

  // A pan or a zoom changes no prop of the section, so it does not render
  // the section's frames again.
  const sectionElement = useMemo(
    () => (section ? <CanvasSection {...section} reading={reading} /> : null),
    [reading, section],
  );
  const canvasElement = useMergedRef(canvas, canvasRef);
  const stageElement = useMergedRef(stageBox, stageRef);
  const drawn = drawnPosition(view);
  return (
    <div
      className="mbk-canvas mbk-reset"
      data-canvas-panning={panning ? "" : undefined}
      data-canvas-tags={canvasTagsShown(view.zoom) ? undefined : "hidden"}
      data-mokly-stage={routed ? "" : undefined}
      ref={canvasElement}
      style={{
        backgroundPosition: `${drawn.x % GRID_PITCH}px ${drawn.y % GRID_PITCH}px`,
      }}
    >
      <div
        aria-hidden="true"
        className="mbk-canvas-stage mbk-reset"
        ref={stageElement}
      />
      {holds ? (
        <>
          <div
            className="mbk-canvas-world mbk-reset"
            style={
              {
                "--mbk-canvas-zoom": view.zoom,
                transform: `translate(${drawn.x}px, ${drawn.y}px)`,
              } as CSSProperties
            }
          >
            {sectionElement}
          </div>
          <div className="mbk-canvas-pill mbk-reset" ref={pill}>
            <CanvasZoomPill
              onFit={handle.fit}
              onZoomIn={handle.zoomIn}
              onZoomOut={handle.zoomOut}
              zoom={view.zoom}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
