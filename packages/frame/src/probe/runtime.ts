import type {
  Box,
  FrameNavigation,
  InstanceBoundary,
} from "../frame_adapter.js";

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
  let regions: (readonly [InstanceBoundary, readonly Box[], number])[] = [];
  const measure = (): readonly InstanceBoundary[] => {
    const boundaries = reader.__list();
    // Rank physical ranges, since one key can occur at different depths.
    regions = boundaries
      .flatMap((boundary) =>
        boundary.ranges.map(
          ({ id, boxes }) =>
            [boundary, boxes, depths[Number(id.slice(2))]!] as const,
        ),
      )
      .sort((a, b) => b[2] - a[2]);
    return boundaries;
  };
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
    const boundary = regions.find(
      ([{ key }, boxes]) =>
        event &&
        (!active || keys.includes(key)) &&
        boxes.some(
          ({ x, y, width, height }) =>
            event.clientX >= x &&
            event.clientX <= x + width &&
            event.clientY >= y &&
            event.clientY <= y + height,
        ),
    )?.[0];
    const key = boundary?.key ?? null,
      boxes = boundary?.ranges.flatMap(({ boxes }) => boxes) ?? [];
    if (boxes.length > 64) throw "limit";
    return { key, boxes };
  };
  const tick = (time: number) => {
    if (time - last < 1000 / 60) {
      pending = environment.requestAnimationFrame(tick);
      return;
    }
    pending = 0;
    last = time;
    let hover: ReturnType<typeof point> | undefined;
    try {
      if (active || (pointer !== false && events.includes("hover"))) measure();
      if (pointer !== false && events.includes("hover")) hover = point(pointer);
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
  const changed = () => {
    dirty = true;
    schedule();
  };
  const activate = (event: MouseEvent) => {
    let hit: ReturnType<typeof point> | undefined;
    let error: ReturnType<typeof inspectionError> | undefined;
    try {
      if (active || events.includes("click")) {
        measure();
        hit = point(event);
      }
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
  on("pointermove", (event) => {
    pointer = event as MouseEvent;
    if (events.includes("hover")) schedule();
  });
  on("pointerleave", () => {
    pointer = null;
    if (events.includes("hover")) schedule();
  });
  on("click", activate as EventListener);
  on("auxclick", activate as EventListener);
  on("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && active) {
      event.preventDefault();
      active = false;
      emit({ type: "pick-end", reason: "escape" });
    }
  });
  on("scroll", changed);
  on("load", changed);
  win.addEventListener("resize", changed, options);
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
    controller.abort();
    resize.disconnect();
    mutations.disconnect();
    environment.cancelAnimationFrame(pending);
    disposed();
  };
  win.addEventListener("pagehide", dispose, options);
  return {
    __list: () => run(measure),
    __highlight: (
      requested: readonly string[],
      mode: "off" | "highlight" | "pick",
    ) =>
      run(() => {
        if (mode !== "off") {
          reader.__keys(requested);
          measure();
        }
        keys = requested;
        active = mode !== "off";
      }),
    __scroll: (key: string) => run(() => reader.__scroll(key)),
    __subscribe: (subscribed: readonly ProbeSubscription[]) => {
      events = subscribed;
    },
    __dispose: dispose,
  };
};
