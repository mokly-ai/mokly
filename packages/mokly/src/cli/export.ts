import type { ResolvedConfig } from "../config/types.js";
import { exportCatalogue } from "../export/run.js";
import type { ExportOptions, ExportResult } from "../export/types.js";

import { withCommandKeepAlive } from "./keep_alive.js";

/** Drain export work and cleanup before returning from a termination signal. */
export async function runExport(
  config: ResolvedConfig,
  options: ExportOptions,
): Promise<ExportResult> {
  return withCommandKeepAlive(async () => {
    const controller = new AbortController();
    const cancel = (): void => controller.abort();
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    try {
      return await exportCatalogue(config, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
    }
  });
}
