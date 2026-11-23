import type { FrameEvent } from "../frame_adapter.js";

import type { ProbeSubscription } from "./runtime_types.js";

type CanvasKeyEvent = Extract<FrameEvent, { type: "canvas-key" }>;
type CanvasWheel = Extract<FrameEvent, { type: "canvas-wheel" }>;
type CanvasPinch = Extract<FrameEvent, { type: "canvas-pinch" }>;

/** Map keys outside editable controls, including controls in another realm. */
export function canvasKey(
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "target"
  >,
): CanvasKeyEvent["key"] | undefined {
  const target:
    (EventTarget & { localName?: string; isContentEditable?: boolean }) | null =
    event.target;
  const name = target?.localName;
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (typeof name === "string" &&
      (target?.isContentEditable === true ||
        name === "input" ||
        name === "select" ||
        name === "textarea"))
  )
    return;
  if (event.shiftKey && event.code === "Digit0") return "zoom-100";
  if (event.shiftKey && event.code === "Digit1") return "fit";
  if (event.key === "+" || event.key === "=") return "zoom-in";
  if (event.key === "-") return "zoom-out";
}

type WebKitGesture = MouseEvent & { scale: number };

export function canvasPointerInput(
  doc: Document,
  schedule: () => void,
  emit: (event: CanvasWheel | CanvasPinch) => void,
) {
  const options = { capture: true, passive: false };
  const wheels: CanvasWheel[] = [];
  let pinch: CanvasPinch | undefined;
  let previousScale = 0;

  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const { deltaMode, deltaY, clientX: x, clientY: y } = event;
    if (deltaMode !== 0 && deltaMode !== 1 && deltaMode !== 2) return;
    event.preventDefault();
    const last = wheels.at(-1);
    if (last?.deltaMode === deltaMode) {
      last.deltaY += deltaY;
      last.x = x;
      last.y = y;
    } else wheels.push({ type: "canvas-wheel", deltaY, deltaMode, x, y });
    schedule();
  };
  const gesture = (event: Event) => {
    event.preventDefault();
    // The standard DOM types do not include WebKit's gesture event.
    const { type, scale, clientX: x, clientY: y } = event as WebKitGesture;
    if (!(scale > 0)) return;
    const baseline = type === "gesturestart" ? scale : previousScale;
    previousScale = type === "gestureend" || !baseline ? 0 : scale;
    if (!baseline) return;
    const factor = scale / baseline;
    if (factor === 1 && !pinch) return;
    pinch = { type: "canvas-pinch", scale: (pinch?.scale ?? 1) * factor, x, y };
    schedule();
  };
  return {
    __flush() {
      let next = wheels.shift();
      while (next && !next.deltaY) next = wheels.shift();
      const gesture = pinch;
      pinch = undefined;
      if (wheels.length) schedule();
      if (next) emit(next);
      if (gesture && gesture.scale !== 1) emit(gesture);
    },
    __subscribe(events: readonly ProbeSubscription[]) {
      const toggle = (
        type: ProbeSubscription,
        names: readonly string[],
        listener: EventListener,
      ) => {
        const enabled = events.includes(type);
        const method = enabled ? "addEventListener" : "removeEventListener";
        for (const name of names) doc[method](name, listener, options);
        return !enabled;
      };
      if (toggle("canvas-wheel", ["wheel"], wheel as EventListener))
        wheels.length = 0;
      if (
        toggle(
          "canvas-pinch",
          ["gesturestart", "gesturechange", "gestureend"],
          gesture,
        )
      ) {
        previousScale = 0;
        pinch = undefined;
      }
    },
  };
}
