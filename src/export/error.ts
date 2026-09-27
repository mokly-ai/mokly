import {
  errorMessage,
  isCancellation,
  MoklyError,
  type MoklyErrorOptions,
} from "../errors.js";

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

/** Classify only failures from the documented pre-installation window. */
export async function withPreInstallationCancellation<Result>(
  signal: AbortSignal | undefined,
  action: () => Promise<Result>,
): Promise<Result> {
  try {
    return await action();
  } catch (error) {
    if (!signal?.aborted || isCancellation(error)) throw error;
    if (error instanceof MoklyError) {
      const prefix = `[mokly/${error.code}] `;
      const message = error.message.startsWith(prefix)
        ? error.message.slice(prefix.length)
        : error.message;
      const cancellation = new MoklyError(error.code, message, {
        cancelled: true,
        cause: error,
        ...(error.presentation ? { presentation: error.presentation } : {}),
      });
      cancellation.message = error.message;
      throw cancellation;
    }
    throw exportError(
      `Could not export catalogue: ${errorMessage(error)}`,
      error,
      { cancelled: true },
    );
  }
}

/** Stop before committing output after a cancellation request. */
export function assertExportActive(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw exportError("Export cancelled; retry when ready.", undefined, {
      cancelled: true,
    });
}
