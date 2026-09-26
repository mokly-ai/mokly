import type { BuildWarningSink } from "../build/warning_sink.js";

import type { RuntimeWatchAction } from "./watch_events.js";

/** A rebuild gets a fresh warning identity set, then flushes before its outcome. */
export function scopedWatchWarnings(
  process: (action: RuntimeWatchAction) => Promise<void>,
  warnings: BuildWarningSink,
): (action: RuntimeWatchAction) => Promise<void> {
  return async (action) => {
    if (action === "rebuild" || action === "reconfigure") warnings.reset();
    try {
      await process(action);
    } finally {
      warnings.flush();
    }
  };
}
