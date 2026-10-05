import type { MoklyError } from "../../errors.js";

/** Preserve the first diagnostic for one source despite later resolver callbacks. */
export function recordFirstFailure(
  failures: Map<string, MoklyError>,
  source: string,
  error: MoklyError,
): void {
  if (!failures.has(source)) failures.set(source, error);
}
