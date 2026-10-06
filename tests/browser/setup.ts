import type { FullConfig } from "@playwright/test";

import { waitForInitialChanges } from "../helpers/watched_catalogue.js";

import { exampleServerPorts } from "./example_servers.js";

/** Wait for every worker's example HEAD comparison to reach a terminal state. */
export default async function setup(config: FullConfig): Promise<void> {
  const ports = exampleServerPorts();
  if (config.workers > ports.length)
    throw new Error(
      `Playwright runs ${config.workers} workers but starts ${ports.length} example server(s); set MOKLY_PLAYWRIGHT_WORKERS=${config.workers} instead of passing --workers`,
    );
  await Promise.all(
    ports.map((port) =>
      waitForInitialChanges(`http://127.0.0.1:${port}`, 180_000),
    ),
  );
}
