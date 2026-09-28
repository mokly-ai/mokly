/** Private Live-preview descriptor and response validation. */

/** Browser-bundle readiness exposed only through Serve's private channel. */
export type InteractiveBundleState = "idle" | "building" | "ready" | "failed";

/** Stable Live origin identity plus its current bundle state. */
export interface ViewerInteractiveDescriptor {
  generation: string;
  /** Explicit browser-facing origin for forwarded environments. */
  origin?: string;
  /** Loopback listener port, including when an explicit origin is advertised. */
  port: number;
  state: InteractiveBundleState;
}

/** Small consumer-text-free response from the private preparation endpoint. */
export interface InteractivePrepareResponse {
  generation: string;
  state: "failed" | "ready";
}

/** Strictly validate a private Live descriptor from HTML or an SSE update. */
export function readViewerInteractiveDescriptor(
  value: unknown,
): ViewerInteractiveDescriptor {
  if (!record(value) || !exact(value, descriptorKeys(value)))
    throw new Error("Invalid live viewer interactive descriptor.");
  const origin = value["origin"];
  if (
    !generation(value["generation"]) ||
    !port(value["port"]) ||
    !state(value["state"]) ||
    (origin !== undefined && !canonicalOrigin(origin))
  )
    throw new Error("Invalid live viewer interactive descriptor.");
  return {
    generation: value["generation"],
    port: value["port"],
    state: value["state"],
    ...(origin === undefined ? {} : { origin }),
  };
}

/** Strictly validate the result of awaiting one generation's bundle. */
export function readInteractivePrepareResponse(
  value: unknown,
): InteractivePrepareResponse {
  if (
    !record(value) ||
    !exact(value, ["generation", "state"]) ||
    !generation(value["generation"]) ||
    (value["state"] !== "ready" && value["state"] !== "failed")
  )
    throw new Error("Invalid live viewer interactive preparation response.");
  return { generation: value["generation"], state: value["state"] };
}

/** Compare the stable listener identity while allowing readiness to advance. */
export function sameViewerInteractiveOrigin(
  left: ViewerInteractiveDescriptor | undefined,
  right: ViewerInteractiveDescriptor | undefined,
): boolean {
  return (
    left?.generation === right?.generation &&
    left?.origin === right?.origin &&
    left?.port === right?.port
  );
}

/**
 * Adopt newer readiness for the same listener identity. A generation's
 * `ready` or `failed` result is final, so a late `building` event cannot
 * return a prepared generation to preparing.
 */
export function advancedViewerInteractive(
  current: ViewerInteractiveDescriptor | undefined,
  next: ViewerInteractiveDescriptor,
): ViewerInteractiveDescriptor {
  return current &&
    sameViewerInteractiveOrigin(current, next) &&
    (current.state === "ready" || current.state === "failed")
    ? current
    : next;
}

function descriptorKeys(value: Record<string, unknown>): readonly string[] {
  return [
    "generation",
    ...(value["origin"] === undefined ? [] : ["origin"]),
    "port",
    "state",
  ];
}

function canonicalOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function generation(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

function port(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= 1 &&
    (value as number) <= 65_535
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function state(value: unknown): value is InteractiveBundleState {
  return (
    value === "idle" ||
    value === "building" ||
    value === "ready" ||
    value === "failed"
  );
}
