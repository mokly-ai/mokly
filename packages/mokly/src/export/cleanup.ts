import { errorMessage } from "../errors.js";

import { exportError } from "./error.js";

/** Preserve both failures, in causal order, without hiding either CLI diagnostic. */
export async function failAfterExportCleanup(
  primary: unknown,
  cleanup: () => Promise<void>,
): Promise<never> {
  try {
    await cleanup();
  } catch (secondary) {
    throw exportError(
      `Export failed: ${errorMessage(primary)}\nCleanup also failed: ${errorMessage(secondary)}`,
      new AggregateError([primary, secondary]),
    );
  }
  throw primary;
}

/** Always drain cleanup, but never replace an earlier operation failure with it. */
export async function withExportCleanup<T>(
  operation: () => Promise<T>,
  cleanup: () => Promise<void>,
): Promise<T> {
  let result: T;
  try {
    result = await operation();
  } catch (error) {
    return failAfterExportCleanup(error, cleanup);
  }
  await cleanup();
  return result;
}
