import type { FrameNavigation, InstanceBoundary } from "../frame_adapter.js";

import { canvasKey, canvasPointerInput } from "./canvas_input.js";
import { contentBox } from "./content_box.js";
import { inspection, inspectionError } from "./inspection.js";
import type { ProbeMetadata } from "./metadata.js";
import type {
  ProbeEnvironment,
  ProbeNavigation,
  ProbeRuntimeCallback,
  ProbeRuntimeEvent,
  ProbeSubscription,
} from "./runtime_types.js";
/** One document's event core, independent of its transport and callback realm. */
export const probeRuntime = (
  win: Window,
  metadata: ProbeMetadata,
  environment: ProbeEnvironment,
  navigate: ProbeNavigation,
  send: ProbeRuntimeCallback,
  disposed = () => {},
) => {
  const doc = win.document,
    reader = inspection(doc, metadata);
  const controller = new environment.AbortController();
  const options = { signal: controller.signal, capture: true };
  const depths: number[] = [];
  for (const [, parent] of metadata.ranges)
    depths.push(parent === null ? 0 : depths[parent]! + 1);
  let events: readonly ProbeSubscription[] = [],
    keys: readonly string[] = [];
  let active = false,
    pending = 0,
    last = 0,
    dirty = false;
  let pointer: MouseEvent | null | false = false;
  let focusPending = false;
  let lastFocus: boolean | null | undefined;
  const emit = (event: Exclude<ProbeRuntimeEvent, { type: "error" }>) => {
    if (events.includes(event.type)) send(event);
  };
  const run = <T>(operation: () => T): T => {
    try {
      return operation();
    } catch (error) {
      active = false;
      throw error;
    }
  };
  const fail = (error: unknown) => {
    active = false;
    send({ type: "error", code: inspectionError(error) });
  };
  const point = (event: MouseEvent | null) => {
    const boundaries = reader.__list();
    let boundary: InstanceBoundary | undefined;
    let deepest = -1;
    if (event) {
      const { clientX, clientY } = event;
      for (const candidate of boundaries) {
        if (active && !keys.includes(candidate.key)) continue;
        for (const { id, boxes } of candidate.ranges) {
          const depth = depths[Number(id.slice(2))]!;
          if (depth <= deepest) continue;
          if (
            boxes.some(
              ({ x, y, width, height }) =>
                clientX >= x &&
                clientX <= x + width &&
                clientY >= y &&
                clientY <= y + height,
            )
          ) {
            deepest = depth;
            boundary = candidate;
          }
        }
      }
    }
    const key = boundary?.key ?? null,
      boxes = boundary?.ranges.flatMap(({ boxes }) => boxes) ?? [];
    if (boxes.length > 64) throw "limit";
    return { key, boxes };
  };
  const tick = (time: number) => {
    pending = 0;
    if (time - last < 1000 / 60) {
      schedule();
      return;
    }
    last = time;
    canvas.__flush();
    flushFocus();
    let hover: ReturnType<typeof point> | undefined;
    try {
      if (pointer !== false && events.includes("hover")) hover = point(pointer);
      else if (active) reader.__list();
    } catch (error) {
      pointer = false;
      fail(error);
      return;
    }
    pointer = false;
    if (dirty) {
      dirty = false;
      emit({ type: "geometry" });
    }
    if (hover) emit({ type: "hover", ...hover });
  };
  const schedule = () => {
    pending ||= environment.requestAnimationFrame(tick);
  };
  const focusChanged = () => {
    if (!events.includes("canvas-focus")) return;
    focusPending = true;
    schedule();
  };
  const flushFocus = () => {
    if (!focusPending) return;
    focusPending = false;
    const visible = doc.hasFocus()
      ? (doc.activeElement?.matches(":focus-visible") ?? false)
      : null;
    if (visible === lastFocus) return;
    lastFocus = visible;
    emit(
      visible === null
        ? { type: "canvas-blur" }
        : { type: "canvas-focus", visible },
    );
  };
  const canvas = canvasPointerInput(doc, schedule, emit);
  const subscribe = (subscribed: readonly ProbeSubscription[]) => {
    if (controller.signal.aborted) return;
    canvas.__subscribe(subscribed);
    const focus = subscribed.includes("canvas-focus");
    if (focus !== events.includes("canvas-focus")) {
      lastFocus = undefined;
      focusPending = focus;
      if (focus) schedule();
    }
    events = subscribed;
  };
  const changed = () => {
    dirty = true;
    schedule();
  };
  const activate = (event: MouseEvent) => {
    let hit: ReturnType<typeof point> | undefined;
    let error: ReturnType<typeof inspectionError> | undefined;
    try {
      if (active || events.includes("click")) hit = point(event);
    } catch (failure) {
      active = false;
      error = inspectionError(failure);
    }
    let navigation: FrameNavigation | undefined;
    if (hit?.key && active) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else navigation = navigate(event);
    if (navigation && events.includes("navigation")) event.preventDefault();
    try {
      if (error) fail(error);
      if (hit?.key) emit({ type: "click", key: hit.key, boxes: hit.boxes });
    } finally {
      if (navigation) emit({ type: "navigation", navigation });
    }
  };
  const on = (name: string, listener: EventListener) =>
    doc.addEventListener(name, listener, options);
  const move = (event: MouseEvent | null) => {
    pointer = event;
    if (events.includes("hover")) schedule();
  };
  doc.addEventListener("pointermove", move, options);
  on("pointerleave", () => move(null));
  on("click", activate as EventListener);
  on("auxclick", activate as EventListener);
  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        active = false;
        emit({ type: "pick-end", reason: "escape" });
      } else if (events.includes("canvas-key")) {
        const key = canvasKey(event);
        if (key) send({ type: "canvas-key", key });
      }
    },
    options,
  );
  on("scroll", changed);
  on("load", changed);
  win.addEventListener("resize", changed, options);
  win.addEventListener("focus", focusChanged, options);
  win.addEventListener("blur", focusChanged, options);
  doc.fonts.addEventListener("loadingdone", changed, options);
  const resize = new environment.ResizeObserver(changed),
    mutations = new environment.MutationObserver(changed);
  if (doc.body) resize.observe(doc.body);
  mutations.observe(doc, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  const dispose = () => {
    if (controller.signal.aborted) return;
    subscribe([]);
    controller.abort();
    resize.disconnect();
    mutations.disconnect();
    environment.cancelAnimationFrame(pending);
    disposed();
  };
  win.addEventListener("pagehide", dispose, options);
  return {
    __list: () => run(reader.__list),
    __highlight: (
      requested: readonly string[],
      mode: "off" | "highlight" | "pick",
    ) =>
      run(() => {
        if (mode !== "off") {
          reader.__keys(requested);
          reader.__list();
        }
        keys = requested;
        active = mode !== "off";
      }),
    __scroll: (key: string) => run(() => reader.__scroll(key)),
    __boxModel: reader.__boxModel,
    __contentBox: () => contentBox(doc),
    __subscribe: subscribe,
    __dispose: dispose,
  };
};
