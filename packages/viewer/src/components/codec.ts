import {
  assertPlainData,
  DataBudget,
  denseArray,
  invalidData,
  plainKeys,
} from "./data.js";
import type {
  ComponentPropsData,
  ComponentWireProps,
  ComponentWireValue,
  PropValue,
} from "./prop_types.js";

/** Encode already validated props in the lossless material-key representation. */
export function encodeProps(props: ComponentPropsData): ComponentWireProps {
  assertPlainData(props);
  return Object.fromEntries(
    Object.keys(props)
      .sort()
      .map((key) => [key, encodeValue(props[key]!)]),
  );
}

export function encodeValue(value: PropValue): ComponentWireValue {
  if (value === null) return ["null"];
  if (typeof value === "number")
    return ["number", Object.is(value, -0) ? "-0" : String(value)];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "boolean") return ["boolean", value];
  if (Array.isArray(value)) return ["array", value.map(encodeValue)];
  const object = value as ComponentPropsData;
  return [
    "object",
    Object.keys(object)
      .sort()
      .map((key) => [key, encodeValue(object[key]!)] as const),
  ];
}

/** Decode only canonical tuples; validating schemas remains the caller's duty. */
export function decodeValue(value: unknown): PropValue {
  return decode(value, "$wire", new DataBudget(), 0);
}

export function decodeProps(value: unknown): ComponentPropsData {
  const budget = new DataBudget();
  budget.visit(0, "$props");
  return Object.fromEntries(
    plainKeys(value, "$props").map((key) => [
      key,
      decode(
        (value as Record<string, unknown>)[key],
        `$props.${key}`,
        budget,
        1,
      ),
    ]),
  );
}

function decode(
  value: unknown,
  at: string,
  budget: DataBudget,
  depth: number,
): PropValue {
  budget.visit(depth, at);
  denseArray(value, at);
  const [kind, payload] = value;
  if (kind === "null" && value.length === 1) return null;
  if (value.length !== 2) invalidData(at, "invalid wire tuple length");
  if (kind === "string" && typeof payload === "string") return payload;
  if (kind === "boolean" && typeof payload === "boolean") return payload;
  if (kind === "number" && typeof payload === "string") {
    const number = Number(payload);
    if (
      Number.isFinite(number) &&
      (Object.is(number, -0) ? "-0" : String(number)) === payload
    )
      return number;
    invalidData(at, "noncanonical number");
  }
  if (kind === "array") {
    denseArray(payload, at);
    return payload.map((item, i) =>
      decode(item, `${at}[${i}]`, budget, depth + 1),
    );
  }
  if (kind === "object") {
    denseArray(payload, at);
    const object: Record<string, PropValue> = {};
    let previous: string | undefined;
    for (const pair of payload) {
      denseArray(pair, at);
      if (pair.length !== 2 || typeof pair[0] !== "string")
        invalidData(at, "invalid object entry");
      const key = pair[0];
      if (previous !== undefined && previous >= key)
        invalidData(at, "object keys must be unique and sorted");
      plainKeys({ [key]: null }, at);
      object[key] = decode(pair[1], `${at}.${key}`, budget, depth + 1);
      previous = key;
    }
    return object;
  }
  return invalidData(at, "unknown or malformed wire value");
}
