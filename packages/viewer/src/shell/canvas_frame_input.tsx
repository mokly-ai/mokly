/**
 * The canvas input of the canvas's frames. The canvas gives its route to the
 * frames that it holds, and each frame hands the input that its document
 * forwards to that route.
 */

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";

import type { CanvasStageHandle } from "@mokly/ui/canvas-stage";

import {
  routeCanvasInput,
  type CanvasGestureEvent,
  type CanvasInputListener,
} from "./canvas_input.js";
import { FrameStageContext } from "./frame_layout_context.js";

/** Moves the canvas that holds a frame for one input of the frame. */
type CanvasInputRoute = (
  event: CanvasGestureEvent,
  frame: HTMLIFrameElement,
) => void;

/** The route of the canvas that holds a frame, if any. */
export const CanvasInputContext = createContext<CanvasInputRoute | undefined>(
  undefined,
);

/**
 * The route of one canvas. Input moves the canvas only while it shows, as
 * the canvas's own keys do, so a frame that keeps focus while a comparison
 * hides the canvas moves nothing.
 */
function useCanvasInputRoute(
  canvas: RefObject<HTMLDivElement | null>,
  handle: RefObject<CanvasStageHandle | null>,
  shown: (canvas: HTMLElement) => boolean,
): CanvasInputRoute {
  return useCallback(
    (event, frame) => {
      const element = canvas.current;
      if (!element || !handle.current || !shown(element)) return;
      routeCanvasInput(event, frame, element, handle.current);
    },
    [canvas, handle, shown],
  );
}

/**
 * The contexts that a canvas gives the frames that it holds: the canvas as
 * the stage that clips them, and the route of their documents' input.
 */
export function CanvasFrameContexts({
  canvas,
  children,
  handle,
  shown,
}: {
  canvas: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  handle: RefObject<CanvasStageHandle | null>;
  /** Whether the canvas shows, which a comparison in its place hides. */
  shown: (canvas: HTMLElement) => boolean;
}) {
  const route = useCanvasInputRoute(canvas, handle, shown);
  return (
    <FrameStageContext value={canvas}>
      <CanvasInputContext value={route}>{children}</CanvasInputContext>
    </FrameStageContext>
  );
}

/**
 * The listener of one canvas frame's document: its wheel, pinch and keys
 * reach the canvas that holds the frame.
 */
export function useCanvasFrameInput(): CanvasInputListener {
  const route = useContext(CanvasInputContext);
  return useCallback(
    (event, frame) => {
      if (event.type === "canvas-focus" || event.type === "canvas-blur") return;
      route?.(event, frame);
    },
    [route],
  );
}
