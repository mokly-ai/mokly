import type { FullConfig } from "@playwright/test";

import { reportBrowserStartup } from "../helpers/browser_timing.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";
import { waitForInitialChanges } from "../helpers/watched_catalogue.js";

import { exampleServerPorts } from "./example_servers.js";

/** Check workers and await Serve readiness before reporting startup. */
export default async function setup(config: FullConfig): Promise<void> {
  const ports = exampleServerPorts();
  if (config.workers > ports.length)
    throw new Error(
      `Playwright runs ${config.workers} workers but starts ${ports.length} example server(s); set MOKLY_PLAYWRIGHT_WORKERS=${config.workers} instead of passing --workers`,
    );
  await timeFixturePhase("browser-suite", "global-setup", false, async () => {
    await timeFixturePhase("browser-suite", "serve-readiness", false, () =>
      Promise.all(
        ports.map((port) =>
          waitForInitialChanges(`http://127.0.0.1:${port}`, 180_000),
        ),
      ),
    );
  });
  reportBrowserStartup();
}
