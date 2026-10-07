import { test as base } from "@playwright/test";

import { runWithPreviewServerLogs } from "./preview_server_logs.js";

/**
 * Playwright test type for specs that serve Wrangler previews. A failed or
 * timed-out test reports the logs of the preview servers that ran during it.
 */
export const test = base.extend<{ previewServerLogs: void }>({
  previewServerLogs: [
    async ({ browserName: _browserName }, use, testInfo) => {
      await runWithPreviewServerLogs(
        testInfo,
        () => use(),
        (text) => {
          process.stderr.write(text);
        },
      );
    },
    { auto: true },
  ],
});
