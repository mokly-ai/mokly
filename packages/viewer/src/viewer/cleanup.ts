/** Drain every owner even when callbacks throw, preserving the first thrown value. */
export function runCleanup(actions: readonly (() => void)[]): void {
  let failure: { error: unknown } | undefined;
  try {
    actions[0]?.();
  } catch (error) {
    failure = { error };
  } finally {
    for (const action of actions.slice(1)) {
      try {
        action();
      } catch (error) {
        failure ??= { error };
      }
    }
  }
  if (failure) throw failure.error;
}
