import type { ApiError } from "../api/errors";

/**
 * A stand-in for `data/use-resource` in a logic test that renders a screen.
 * Server rendering runs no effect, so a real read never settles there and a
 * screen would only ever draw its loading state. A test resolves the module
 * to this one and answers each read it needs from `answers`, or fails it from
 * `failures`, keyed by the start of the read's key; any other read stays
 * loading.
 */

/** What each read answers, by the start of its key. */
export const answers = new Map<string, unknown>();

/** What each read fails with, by the start of its key, before any answer. */
export const failures = new Map<string, ApiError>();

/** The value one table holds for a key, by the start of that key. */
function forKey<T>(
  table: Map<string, T>,
  key: string,
): { value: T } | undefined {
  const found = [...table].find(([prefix]) => key.startsWith(prefix));
  return found === undefined ? undefined : { value: found[1] };
}

/** `useResource`, answering from the tables and never loading anything. */
export function useResource(_load: () => Promise<unknown>, key: string) {
  const failure = forKey(failures, key);
  const answer = forKey(answers, key);
  return {
    key,
    state:
      failure !== undefined
        ? { status: "error" as const, error: failure.value }
        : answer === undefined
          ? { status: "loading" as const }
          : { status: "ready" as const, value: answer.value },
    reload: () => undefined,
    set: () => undefined,
  };
}
