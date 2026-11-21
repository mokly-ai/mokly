/** Only the newest asynchronous request may apply its answer. */
export interface RequestSequence {
  next: () => () => boolean;
  invalidate: () => void;
}

/** Create a sequence for one owner of asynchronous requests. */
export function createRequestSequence(): RequestSequence {
  let generation = 0;
  return {
    next: () => {
      const current = ++generation;
      return () => current === generation;
    },
    invalidate: () => {
      generation += 1;
    },
  };
}
