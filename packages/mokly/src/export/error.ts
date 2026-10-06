import {
  errorMessage,
  isCancellation,
  markCancellation,
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
    if (isCancellation(error) || signal === undefined) throw error;
    if (!signal.aborted) await completeSignalTurn();
    if (!signal.aborted) throw error;
    if (error instanceof MoklyError) throw markCancellation(error);
    throw exportError(
      `Could not export catalogue: ${errorMessage(error)}`,
      error,
      { cancelled: true },
    );
  }
}

async function completeSignalTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Stop before committing output after a cancellation request. */
export function assertExportActive(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw exportError("Export cancelled; retry when ready.", undefined, {
      cancelled: true,
    });
}
