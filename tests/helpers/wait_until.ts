/** Options for polling an expected state. */
export interface WaitUntilOptions {
  /** Maximum wait in milliseconds; at least 10,000 and defaults to 15,000. */
  readonly timeoutMs?: number;
  /** Pause in milliseconds between probes; defaults to 10. */
  readonly intervalMs?: number;
  /** Timeout error text; defaults to a message that names timeoutMs. */
  readonly message?: string;
}

/** Poll immediately and after each pause; return a narrowed result and preserve probe failures. */
export async function waitUntil<T>(
  probe: () => T | PromiseLike<T>,
  options: WaitUntilOptions = {},
): Promise<Exclude<Awaited<T>, undefined | null | false>> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const intervalMs = options.intervalMs ?? 10;
  if (timeoutMs < 10_000)
    throw new RangeError("waitUntil timeoutMs must be at least 10000 ms");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await probe();
    if (result !== undefined && result !== null && result !== false)
      return result as Exclude<Awaited<T>, undefined | null | false>;
    if (Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    } else {
      throw new Error(
        options.message ?? `waitUntil timed out after ${timeoutMs} ms`,
      );
    }
  }
}
