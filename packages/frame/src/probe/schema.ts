import type {
  FrameEvent,
  FrameNavigation,
  InstanceBoundary,
  InstanceBoxModel,
  Box,
} from "../frame_adapter.js";

import {
  array,
  boxes,
  coordinate,
  shape,
  key,
  navigation,
  object,
  rangeId,
  requestId,
  unique,
  textMatch,
  type CANVAS_EVENTS,
  EVENTS,
  type ProbeEventType,
} from "./values.js";
export type ProbeError =
  "unavailable" | "invalid-boundary" | "limit" | "missing-instance";
export type MessageBody =
  | {
      type: "hello";
    }
  | {
      type: "ready";
    }
  | {
      type: "geometry";
    }
  | {
      type: "dispose";
    }
  | {
      type: "list" | "measure-content" | "ack";
      requestId: number;
    }
  | {
      type: "boundaries";
      requestId: number;
      boundaries: readonly InstanceBoundary[];
    }
  | {
      type: "highlight";
      requestId: number;
      keys: readonly string[];
      mode: "off" | "highlight" | "pick";
    }
  | {
      type: "scroll-to" | "measure";
      requestId: number;
      key: string;
    }
  | {
      type: "box-model";
      requestId: number;
      boxModel: InstanceBoxModel | null;
    }
  | {
      type: "content-box";
      requestId: number;
      contentBox: Box | null;
    }
  | {
      type: "subscribe";
      requestId: number;
      events: readonly ProbeEventType[];
    }
  | {
      type: "hover";
      key: string | null;
      boxes: readonly Box[];
    }
  | {
      type: "click";
      key: string;
      boxes: readonly Box[];
    }
  | {
      type: "navigation";
      navigation: FrameNavigation;
    }
  | {
      type: "pick-end";
      reason: "escape";
    }
  | Extract<FrameEvent, { type: (typeof CANVAS_EVENTS)[number] }>
  | {
      type: "error";
      requestId: number | null;
      code: ProbeError;
    };
export type HostMessage = Message & {
  type:
    | "hello"
    | "dispose"
    | "list"
    | "highlight"
    | "scroll-to"
    | "measure"
    | "measure-content"
    | "subscribe";
};
export type Message = MessageBody & {
  channel: "mokly-frame-probe";
  version: 4;
  nonce: string;
};
export const envelope = (
  value: unknown,
  nonce?: string,
): value is Record<string, unknown> =>
  object(value) &&
  value.channel === "mokly-frame-probe" &&
  value.version === 4 &&
  textMatch(value.nonce, /^[a-f\d]{32}$/, 32) &&
  (nonce === undefined || value.nonce === nonce);
const validBoundaries = (value: unknown): value is InstanceBoundary[] => {
  if (!array(value, 1024)) return false;
  let previous = "",
    count = 0,
    total = 0;
  const ids = new Set<string>();
  return value.every((item) => {
    if (
      !object(item) ||
      !shape(item, 2) ||
      !key(item.key) ||
      item.key <= previous ||
      !array(item.ranges, 4096)
    )
      return false;
    previous = item.key;
    return item.ranges.every((range) => {
      if (
        !object(range) ||
        !shape(range, 2) ||
        !rangeId(range.id) ||
        ids.has(range.id) ||
        !boxes(range.boxes)
      )
        return false;
      ids.add(range.id);
      count++;
      total += range.boxes.length;
      return count <= 4096 && total <= 8192;
    });
  });
};
const validSides = (value: unknown): boolean =>
  object(value) &&
  shape(value, 4) &&
  ["top", "right", "bottom", "left"].every((side) => {
    const number = value[side];
    return typeof number === "number" && number >= 0 && number <= 1000000;
  });
const validBoxModel = (value: unknown): boolean =>
  value === null ||
  (object(value) &&
    shape(value, 3) &&
    boxes([value.box]) &&
    validSides(value.border) &&
    validSides(value.padding));
const messageFields = (
  value: Record<string, unknown>,
  count: number,
  request = false,
): boolean =>
  shape(value, 4 + count + +request) &&
  (!request || requestId(value.requestId));
export const validHostMessage = (
  value: unknown,
  nonce?: string,
): value is HostMessage => {
  if (!envelope(value, nonce)) return false;
  const { type } = value;
  if (type === "hello" || type === "dispose") return shape(value, 4);
  if (!requestId(value.requestId)) return false;
  if (type === "list" || type === "measure-content") return shape(value, 5);
  if (type === "highlight")
    return (
      shape(value, 7) &&
      uniqueList(value.keys, 1024, key) &&
      (value.mode === "off"
        ? !value.keys.length
        : value.mode === "highlight" || value.mode === "pick")
    );
  if (!shape(value, 6)) return false;
  if (type === "scroll-to" || type === "measure") return key(value.key);
  return (
    type === "subscribe" &&
    uniqueList(value.events, 10, (event) =>
      EVENTS.includes(event as ProbeEventType),
    )
  );
};
const uniqueList = (
  items: unknown,
  max: number,
  check: (item: unknown) => boolean,
): items is unknown[] =>
  array(items, max) && items.every(check) && unique(items);
const validFrameMessage = (
  value: unknown,
  nonce?: string,
): value is Message => {
  if (!envelope(value, nonce)) return false;
  switch (value.type) {
    case "ready":
    case "geometry":
    case "canvas-blur":
      return messageFields(value, 0);
    case "ack":
      return messageFields(value, 0, true);
    case "boundaries":
      return messageFields(value, 1, true) && validBoundaries(value.boundaries);
    case "box-model":
      return messageFields(value, 1, true) && validBoxModel(value.boxModel);
    case "content-box":
      return (
        messageFields(value, 1, true) &&
        (value.contentBox === null || boxes([value.contentBox]))
      );
    case "hover":
    case "click":
      return (
        messageFields(value, 2) &&
        boxes(value.boxes) &&
        (key(value.key) ||
          (value.type === "hover" &&
            value.key === null &&
            value.boxes.length === 0))
      );
    case "navigation":
      return messageFields(value, 1) && navigation(value.navigation);
    case "pick-end":
      return messageFields(value, 1) && value.reason === "escape";
    case "canvas-wheel":
      return (
        messageFields(value, 4) &&
        coordinate(value.deltaY, -1000000) &&
        (value.deltaMode === 0 ||
          value.deltaMode === 1 ||
          value.deltaMode === 2) &&
        coordinate(value.x, -1000000) &&
        coordinate(value.y, -1000000)
      );
    case "canvas-pinch":
      return (
        messageFields(value, 3) &&
        coordinate(value.scale, 0) &&
        value.scale > 0 &&
        coordinate(value.x, -1000000) &&
        coordinate(value.y, -1000000)
      );
    case "canvas-key":
      return (
        messageFields(value, 1) &&
        (value.key === "zoom-in" ||
          value.key === "zoom-out" ||
          value.key === "zoom-100" ||
          value.key === "fit" ||
          value.key === "escape" ||
          value.key === "search")
      );
    case "canvas-focus":
      return messageFields(value, 1) && typeof value.visible === "boolean";
    case "error":
      return (
        messageFields(value, 2) &&
        (value.requestId === null || requestId(value.requestId)) &&
        [
          "unavailable",
          "invalid-boundary",
          "limit",
          "missing-instance",
        ].includes(value.code as string)
      );
    default:
      return false;
  }
};
export const validMessage = (
  value: unknown,
  nonce?: string,
): value is Message =>
  validHostMessage(value, nonce) || validFrameMessage(value, nonce);
export const encodeMessage = (nonce: string, body: MessageBody): string =>
  JSON.stringify({
    channel: "mokly-frame-probe",
    version: 4,
    nonce,
    ...body,
  });
