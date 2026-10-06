import type { RunningServe } from "../server/serve.js";

import { openServedBrowser } from "./browser.js";
import { ServeShortcuts } from "./reporter/shortcuts.js";
import type { CliReporter, TerminalEnvironment } from "./reporter/types.js";

/** Keep the CLI alive until Serve and its shortcuts have closed. */
export function waitForShutdown(
  running: RunningServe,
  environment: TerminalEnvironment,
  reporter: CliReporter,
  watched: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let closing = false;
    const onSignal = (): void => void close();
    const shortcuts = new ServeShortcuts(environment, reporter, {
      clear: () => reporter.clearServe(),
      close: onSignal,
      help: () => reporter.showShortcuts(),
      open: async () => {
        await openServedBrowser(
          environment.browserOpener,
          reporter,
          running.url,
        );
      },
      rebuild: () => running.rebuild?.(),
    });
    const cleanup = (): void => {
      shortcuts.close();
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    };
    const close = async (): Promise<void> => {
      if (closing) return;
      closing = true;
      try {
        await running.close();
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    if (watched) shortcuts.start();
  });
}
