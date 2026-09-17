import type { FrameEvent, InstanceBoundary } from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";

/** Pointer subscriptions share one listener set with the local mount lifecycle. */
export function localPointer(
  doc: Document,
  read: () => readonly InstanceBoundary[],
  emit: (event: FrameEvent) => void,
  enabled: () => boolean,
  selecting: () => boolean,
  signal: AbortSignal,
): void {
  const win = doc.defaultView!;
  let pending = 0,
    last = -Infinity;
  let pointer: MouseEvent | null = null;
  const report = (type: "hover" | "click", event: MouseEvent | null) => {
    if (!enabled()) return;
    try {
      const boundary = event
        ? read().find((item) =>
            item.ranges.some((range) =>
              range.boxes.some(
                (box) =>
                  event.clientX >= box.x &&
                  event.clientX <= box.x + box.width &&
                  event.clientY >= box.y &&
                  event.clientY <= box.y + box.height,
              ),
            ),
          )
        : undefined;
      const boxes = boundary?.ranges.flatMap((range) => range.boxes) ?? [];
      if (boxes.length > 64) throw new FrameError("limit");
      if (type === "hover") emit({ type, key: boundary?.key ?? null, boxes });
      else if (boundary) emit({ type, key: boundary.key, boxes });
    } catch (error) {
      emit({
        type: "error",
        code:
          error instanceof FrameError
            ? error.code
            : error === "unavailable" || error === "limit"
              ? error
              : "invalid-boundary",
      });
    }
  };
  const schedule = () => {
    if (!pending)
      pending = win.requestAnimationFrame((time) => {
        pending = 0;
        if (time - last < 1000 / 60) {
          schedule();
          return;
        }
        last = time;
        report("hover", pointer);
      });
  };
  doc.addEventListener(
    "pointermove",
    (event) => {
      pointer = event;
      if (enabled()) schedule();
    },
    { signal },
  );
  doc.addEventListener(
    "pointerleave",
    () => {
      pointer = null;
      if (enabled()) schedule();
    },
    { signal },
  );
  const click = (event: MouseEvent) => {
    if (!selecting()) report("click", event);
  };
  doc.addEventListener("click", click, { signal });
  doc.addEventListener("auxclick", click, { signal });
  signal.addEventListener(
    "abort",
    () => {
      if (pending) win.cancelAnimationFrame(pending);
    },
    { once: true },
  );
}
