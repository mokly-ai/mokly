function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read a test's JSON object without depending on catalogue readers. */
export function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError("Expected a JSON object.");
  return value;
}
