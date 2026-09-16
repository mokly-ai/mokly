import type {
  FrameNavigation,
  InstanceBoundary,
  Box,
} from "../client/frame_adapter.js";

import {
  array,
  boxes,
  shape,
  key,
  navigation,
  object,
  rangeId,
  requestId,
  unique,
  EVENTS,
  type InspectorEventType,
} from "./values.js";
export type InspectorError =
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
      type: "list" | "ack";
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
      type: "scroll-to";
      requestId: number;
      key: string;
    }
  | {
      type: "subscribe";
      requestId: number;
      events: readonly InspectorEventType[];
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
  | {
      type: "error";
      requestId: number | null;
      code: InspectorError;
    };
export type HostMessage = Message & {
  type: "hello" | "dispose" | "list" | "highlight" | "scroll-to" | "subscribe";
};
export type Message = MessageBody & {
  channel: "mokly-inspector";
  version: 1;
  nonce: string;
};
export const envelope = (
  value: unknown,
  nonce?: string,
): value is Record<string, unknown> =>
  object(value) &&
  value.channel === "mokly-inspector" &&
  value.version === 1 &&
  typeof value.nonce === "string" &&
  /^[a-f0-9]{32}$/.test(value.nonce) &&
  (nonce === undefined || value.nonce === nonce);
export const validBoundaries = (
  value: unknown,
): value is InstanceBoundary[] => {
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
  if (value.type === "hello" || value.type === "dispose")
    return shape(value, 4);
  if (!requestId(value.requestId)) return false;
  switch (value.type) {
    case "list":
      return shape(value, 5);
    case "highlight":
      return (
        shape(value, 7) &&
        array(value.keys, 1024) &&
        value.keys.every(key) &&
        unique(value.keys) &&
        ["off", "highlight", "pick"].includes(value.mode as string) &&
        (value.mode !== "off" || value.keys.length === 0)
      );
    case "scroll-to":
      return shape(value, 6) && key(value.key);
    case "subscribe":
      return (
        shape(value, 6) &&
        array(value.events, 5) &&
        unique(value.events) &&
        value.events.every((event) =>
          EVENTS.includes(event as InspectorEventType),
        )
      );
    default:
      return false;
  }
};
export const validFrameMessage = (
  value: unknown,
  nonce?: string,
): value is Message => {
  if (!envelope(value, nonce)) return false;
  switch (value.type) {
    case "ready":
    case "geometry":
      return messageFields(value, 0);
    case "ack":
      return messageFields(value, 0, true);
    case "boundaries":
      return messageFields(value, 1, true) && validBoundaries(value.boundaries);
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
    channel: "mokly-inspector",
    version: 1,
    nonce,
    ...body,
  });
