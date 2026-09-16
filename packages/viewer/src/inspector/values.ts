/** Small, shared validators; no DOM or server dependency enters the wire schema. */
import type {
  Box,
  FrameNavigation,
  NavigationTarget,
} from "../client/frame_adapter.js";
export const BYTE_LIMIT = 262144;
export const KEY = /^[a-f0-9]{64}$/;
export const RANGE = /^r-\d+$/;
export const EVENTS = [
  "hover",
  "click",
  "navigation",
  "pick-end",
  "geometry",
] as const;
export type InspectorEventType = (typeof EVENTS)[number];
export type JsonObject = Record<string, unknown>;
export const object = (value: unknown): value is JsonObject =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
/** Known fields are validated individually; an exact count rejects every extra. */
export const shape = (value: JsonObject, count: number): boolean =>
  Object.keys(value).length === count;
export const textMatch = (
  value: unknown,
  pattern: RegExp,
  max: number,
): value is string =>
  typeof value === "string" && value.length <= max && pattern.test(value);
export const key = (value: unknown): value is string =>
  textMatch(value, KEY, 64);
export const rangeId = (value: unknown): value is string =>
  textMatch(value, RANGE, 16);
export const requestId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
export const array = (value: unknown, max: number): value is unknown[] =>
  Array.isArray(value) && value.length <= max;
export const unique = (value: readonly unknown[]): boolean =>
  new Set(value).size === value.length;
export const boxes = (value: unknown): value is Box[] => {
  const coordinate = (number: unknown, minimum: number) =>
    typeof number === "number" && number >= minimum && number <= 1000000;
  return (
    array(value, 64) &&
    value.every(
      (box) =>
        object(box) &&
        shape(box, 4) &&
        coordinate(box.x, -1000000) &&
        coordinate(box.y, -1000000) &&
        coordinate(box.width, 0) &&
        coordinate(box.height, 0),
    )
  );
};
export const target = (value: unknown): value is NavigationTarget =>
  object(value) &&
  (value.kind === "named"
    ? shape(value, 2) &&
      textMatch(value.name, /^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 256)
    : shape(value, 1) &&
      ["self", "top", "parent", "blank"].includes(value.kind as string));
export const identity = (value: JsonObject): boolean =>
  textMatch(value.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 256) &&
  (!Object.hasOwn(value, "fragment") ||
    textMatch(value.fragment, /^[A-Za-z][A-Za-z0-9_:.-]*$/, 256)) &&
  target(value.target);
export const navigation = (value: unknown): value is FrameNavigation =>
  object(value) &&
  shape(value, 3 + Number(Object.hasOwn(value, "fragment"))) &&
  identity(value) &&
  ["primary", "modified", "middle"].includes(value.activation as string);
export const boundedJson = (value: unknown): unknown => {
  if (
    typeof value !== "string" ||
    value.length > BYTE_LIMIT ||
    new TextEncoder().encode(value).length > BYTE_LIMIT
  )
    return;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return;
  }
};
export const origin = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return /^https?:/.test(value) && new URL(value).origin === value;
  } catch {
    return false;
  }
};
