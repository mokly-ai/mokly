import { MoklyError, type MoklyErrorOptions } from "../errors.js";

type ExportErrorOptions = Pick<MoklyErrorOptions, "cancelled">;

/** Contextual failure at the static-export boundary. */
export function exportError(
  message: string,
  cause?: unknown,
  options: ExportErrorOptions = {},
): MoklyError {
  return new MoklyError("export-invalid", message, {
    ...(cause === undefined ? {} : { cause }),
    ...(options.cancelled ? { cancelled: true } : {}),
  });
}

/** Stop before committing output after a cancellation request. */
export function assertExportActive(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw exportError("Export cancelled; retry when ready.", undefined, {
      cancelled: true,
    });
}
