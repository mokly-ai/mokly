import type { Box, InstanceBoundary } from "../client/frame_adapter.js";

import { inspection } from "./inspection.js";
import { inspectorNavigation } from "./links.js";
import type { InspectorMetadata } from "./metadata.js";
import { drawOverlay } from "./overlay.js";
import type { MessageBody, HostMessage } from "./schema.js";
import type { InspectorEventType } from "./values.js";
/** One handshake owns observers, input handling, presentation and ordered requests. */
export const inspectorRuntime = (
  win: Window & typeof globalThis,
  metadata: InspectorMetadata,
  send: (body: MessageBody) => void,
  disposed: () => void,
) => {
  const doc = win.document,
    reader = inspection(doc, metadata);
  const navigate = inspectorNavigation(metadata),
    controller = new win.AbortController();
  const options = { signal: controller.signal, capture: true };
  let events: readonly InspectorEventType[] = [],
    keys: readonly string[] = [];
  let active = false,
    pending = 0,
    last = 0,
    lastRequest = 0,
    dirty = false;
  let layer: HTMLDivElement | undefined,
    pointer: MouseEvent | null | false = false;
  let regions: [string, readonly Box[]][] = [];
  const measure = (): readonly InstanceBoundary[] => {
    const boundaries = reader.__list();
    regions = boundaries.map(({ key, ranges }) => [
      key,
      ranges.flatMap(({ boxes }) => boxes),
    ]);
    return boundaries;
  };
  const emit = (body: MessageBody) => {
    if (events.includes(body.type as InspectorEventType)) send(body);
  };
  const draw = () => {
    if (!active) layer?.remove();
    else
      drawOverlay(
        (layer ??= doc.createElement("div")),
        regions.flatMap(([key, boxes]) => (keys.includes(key) ? boxes : [])),
        win.innerWidth,
        win.innerHeight,
      );
  };
  const fail = (error: unknown, requestId: number | null = null) => {
    active = false;
    draw();
    send({
      type: "error",
      requestId,
      code:
        error === "limit" ||
        error === "missing-instance" ||
        error === "unavailable"
          ? error
          : "invalid-boundary",
    });
  };
  const point = (event: MouseEvent | null, click = false) => {
    const [key, boxes] = regions.find(
      ([key, boxes]) =>
        event &&
        (!active || keys.includes(key)) &&
        boxes.some(
          ({ x, y, width, height }) =>
            event.clientX >= x &&
            event.clientX <= x + width &&
            event.clientY >= y &&
            event.clientY <= y + height,
        ),
    ) ?? [null, []];
    if (boxes.length > 64) throw "limit";
    if (click && key) emit({ type: "click", key, boxes });
    if (!click) emit({ type: "hover", key, boxes });
    return key;
  };
  const tick = (time: number) => {
    if (time - last < 1000 / 60) {
      pending = win.requestAnimationFrame(tick);
      return;
    }
    pending = 0;
    last = time;
    try {
      if (active || (pointer !== false && events.includes("hover"))) measure();
      if (dirty) {
        dirty = false;
        draw();
        emit({ type: "geometry" });
      }
      if (pointer !== false && events.includes("hover")) point(pointer);
      pointer = false;
    } catch (error) {
      fail(error);
    }
  };
  const schedule = () => {
    pending ||= win.requestAnimationFrame(tick);
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
      draw();
      emit({ type: "pick-end", reason: "escape" });
    }
  });
  on("scroll", changed);
  on("load", changed);
  win.addEventListener("resize", changed, options);
  doc.fonts.addEventListener("loadingdone", changed, options);
  const resize = new win.ResizeObserver(changed),
    mutations = new win.MutationObserver(changed);
  if (doc.body) resize.observe(doc.body);
  mutations.observe(doc, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  const dispose = () => {
    controller.abort();
    resize.disconnect();
    mutations.disconnect();
    win.cancelAnimationFrame(pending);
    layer?.remove();
    disposed();
  };
  win.addEventListener("pagehide", dispose, options);
  return (message: Exclude<HostMessage, { type: "hello" }>): void => {
    if (message.type === "dispose") return dispose();
    if (message.requestId <= lastRequest) return;
    const { type, requestId } = message;
    lastRequest = requestId;
    try {
      if (type === "list") {
        send({ type: "boundaries", requestId, boundaries: measure() });
        return;
      }
      if (type === "highlight") {
        if (message.mode !== "off") {
          reader.__keys(message.keys);
          measure();
        }
        keys = message.keys;
        active = message.mode !== "off";
        draw();
      }
      if (type === "scroll-to") reader.__scroll(message.key);
      if (type === "subscribe") events = message.events;
      send({ type: "ack", requestId });
    } catch (error) {
      fail(error, requestId);
    }
  };
};
