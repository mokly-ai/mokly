/** Drain every frame owner while preserving the first cleanup failure. */
export function runFrameCleanup(actions: readonly (() => void)[]): void {
  let failure: { error: unknown } | undefined;
  for (const action of actions) {
    try {
      action();
    } catch (error) {
      failure ??= { error };
    }
  }
  if (failure) throw failure.error;
}
