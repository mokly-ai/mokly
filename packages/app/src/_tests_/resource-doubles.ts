/**
 * A stand-in for `data/use-resource` in a logic test that renders a screen.
 * Server rendering runs no effect, so a real read never settles there and a
 * screen would only ever draw its loading state. A test resolves the module
 * to this one and answers each read it needs from `answers`, keyed by the
 * start of the read's key; any other read stays loading.
 */

/** What each read answers, by the start of its key. */
export const answers = new Map<string, unknown>();

/** `useResource`, answering from `answers` and never loading anything. */
export function useResource(_load: () => Promise<unknown>, key: string) {
  const answer = [...answers].find(([prefix]) => key.startsWith(prefix));
  return {
    key,
    state:
      answer === undefined
        ? { status: "loading" as const }
        : { status: "ready" as const, value: answer[1] },
    reload: () => undefined,
    set: () => undefined,
  };
}
