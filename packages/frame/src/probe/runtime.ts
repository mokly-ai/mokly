import type { Box, InstanceBoundary } from "../frame_adapter.js";

import { inspection, inspectionError } from "./inspection.js";
import type { ProbeMetadata } from "./metadata.js";
import type {
  ProbeEnvironment,
  ProbeNavigation,
  ProbeRuntimeEvent,
  ProbeSubscription,
} from "./runtime_types.js";
/** One document's event core, independent of its transport and callback realm. */
export const probeRuntime = (
  win: Window,
  metadata: ProbeMetadata,
  environment: ProbeEnvironment,
  navigate: ProbeNavigation,
  send: (event: ProbeRuntimeEvent) => void,
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
  const point = (event: MouseEvent | null, click = false) => {
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
    if (click && key) emit({ type: "click", key, boxes });
    if (!click) emit({ type: "hover", key, boxes });
    return key;
  };
  const tick = (time: number) => {
    if (time - last < 1000 / 60) {
      pending = environment.requestAnimationFrame(tick);
      return;
    }
    pending = 0;
    last = time;
    try {
      if (active || (pointer !== false && events.includes("hover"))) measure();
      if (dirty) {
        dirty = false;
        emit({ type: "geometry" });
      }
      if (pointer !== false && events.includes("hover")) point(pointer);
      pointer = false;
    } catch (error) {
      fail(error);
    }
  };
  const schedule = () => {
    pending ||= environment.requestAnimationFrame(tick);
  };
  const changed = () => {
    dirty = true;
    schedule();
  };
  const activate = (event: MouseEvent) => {
    try {
      if (active || events.includes("click")) {
        measure();
        if (point(event, true) && active) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
      const navigation = navigate(event);
      if (navigation && events.includes("navigation")) {
        event.preventDefault();
        emit({ type: "navigation", navigation });
      }
    } catch (error) {
      fail(error);
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
