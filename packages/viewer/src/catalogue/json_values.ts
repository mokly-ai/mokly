import { record } from "../components/data.js";

/** Compare JSON values, including fields from additive format changes. */
export function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left))
    return (
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value: unknown, index) => sameJsonValue(value, right[index]))
    );
  if (!plainRecord(left) || !plainRecord(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) && sameJsonValue(left[key], right[key]),
    )
  );
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Keep the installed reference while the value is equal. */
export function keepEqualJson<T>(installed: T, received: T): T {
  return sameJsonValue(installed, received) ? installed : received;
}
