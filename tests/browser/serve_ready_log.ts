import type { CatalogueReadModel } from "@mokly/viewer";

import { startDuration } from "../helpers/durations.js";

/** The steps of one attempt of a Serve readiness wait. */
type ReadyStep = "reading the index" | "checking the caller's predicate";

/** One index read as the report of a wait names it. */
export function describeRead(index: CatalogueReadModel) {
  return [
    `revision ${index.revision}`,
    `changesStatus ${index.changesStatus}`,
    ...(index.baseCommit ? [`baseCommit ${index.baseCommit}`] : []),
  ].join(", ");
}

/** An error with its own cause, which `fetch` uses for the socket error. */
function describeError(error: unknown) {
  const cause =
    error instanceof Error && error.cause !== undefined
      ? ` (cause: ${String(error.cause)})`
      : "";
  return `${String(error)}${cause}`;
}

/**
 * The record of one readiness wait, for the report of a wait that failed. It
 * keeps the step in progress, the step that failed, and each index state
 * that a read returned, oldest first. The first report line comes only from
 * that record: a failed step ends the wait at once, and a time limit ends it
 * during a step or between two attempts.
 */
export function readyLog() {
  const elapsed = startDuration();
  const states: { state: string; reads: number }[] = [];
  let current: { step: ReadyStep; on?: string } | undefined;
  let failure: string | undefined;
  let completedReads = 0;
  const record = (state: string) => {
    const last = states.at(-1);
    if (last?.state === state) last.reads += 1;
    else states.push({ state, reads: 1 });
  };
  const ending = () => {
    if (failure) return `The wait ended at once because ${failure}.`;
    const during = current
      ? `while ${current.step}${current.on ? ` of ${current.on}` : ""}`
      : "between two attempts";
    return `A time limit ended the wait after ${elapsed()}, ${during}. The cause below names the limit: the 30-second poll or the test's time limit.`;
  };
  return {
    record,
    /** Run one step of an attempt, so that a failed or pending step shows. */
    async step<Value>(
      step: ReadyStep,
      run: () => Promise<Value>,
      on?: string,
    ): Promise<Value> {
      current = { step, ...(on ? { on } : {}) };
      try {
        const value = await run();
        if (step === "reading the index") completedReads += 1;
        current = undefined;
        return value;
      } catch (error) {
        current = undefined;
        failure = `${step}${on ? ` of ${on}` : ""} failed: ${describeError(error)}`;
        throw error;
      }
    },
    report: () =>
      [
        ending(),
        "Index reads, oldest first:",
        ...states.map(({ state, reads }) => `- ${state} (${reads} reads)`),
        ...(states.length > 0
          ? []
          : completedReads > 0
            ? ["- none before the step named above"]
            : ["- no index read completed"]),
      ].join("\n"),
  };
}
