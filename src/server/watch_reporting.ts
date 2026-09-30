import type { WatchRebuildStatus } from "./rebuild_status.js";
import type { ServeReporter } from "./reporter.js";
import {
  type WatchActionOutcome,
  WatchActionFailurePhase,
} from "./watch_action_outcome.js";
import type { RuntimeWatchAction } from "./watch_events.js";

/** Add lifecycle reports around one watched action processor. */
export function reportedWatchProcessor(
  process: (action: RuntimeWatchAction) => Promise<WatchActionOutcome>,
  reporter: ServeReporter,
  repoRoot: () => string,
  rebuildStatus?: WatchRebuildStatus,
): (action: RuntimeWatchAction, paths: readonly string[]) => Promise<void> {
  return async (action, paths) => {
    const reportable = action !== "evidence" || paths.length > 0;
    const startedAt = Date.now();
    const watchReport = (durationMs: number) => ({
      action,
      durationMs,
      paths,
      repoRoot: repoRoot(),
    });
    if (reportable) reporter.watchStarted(watchReport(0));
    let outcome: WatchActionOutcome;
    try {
      outcome = await process(action);
    } catch (error) {
      reporter.watchFailed(watchReport(Date.now() - startedAt), error);
      return;
    }
    if (outcome.type === "failed") {
      reporter.watchFailed(watchReport(Date.now() - startedAt), outcome.error);
      if (outcome.phase === WatchActionFailurePhase.Source)
        rebuildStatus?.sourceFailed(outcome.error);
      return;
    }
    if (reportable) reporter.watchFinished(watchReport(Date.now() - startedAt));
  };
}
