import type { ServeReporter } from "./reporter.js";
import type { RuntimeWatchAction } from "./watch_events.js";

/** Add lifecycle reports around one watched action processor. */
export function reportedWatchProcessor(
  process: (action: RuntimeWatchAction) => Promise<void>,
  reporter: ServeReporter,
  repoRoot: () => string,
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
    try {
      await process(action);
      if (reportable)
        reporter.watchFinished(watchReport(Date.now() - startedAt));
    } catch (error) {
      reporter.watchFailed(watchReport(Date.now() - startedAt), error);
    }
  };
}
