import type { ConcurrencyEnvironment } from "../../scripts/verification/concurrency.mjs";

import { EXAMPLE_BASE } from "../helpers/example_base.js";

/** The shim owns binary lookup. Port zero asks Serve to bind a free port. */
export function exampleServerCommand(port = 0): readonly string[] {
  return [
    "packages/mokly/bin/mokly.mjs",
    "serve",
    "--config",
    "examples/basic/mokly.config.json",
    "--base",
    EXAMPLE_BASE,
    "--port",
    String(port),
    "--no-watch",
    "--sidecars",
    "1",
  ];
}

/** Global setup publishes the URLs before Playwright starts its workers. */
export function ownExampleServerUrl(
  env: ConcurrencyEnvironment = process.env,
): string | undefined {
  const urls = env["MOKLY_PLAYWRIGHT_URLS"];
  if (!urls) return undefined;
  const index = Number(env["TEST_PARALLEL_INDEX"] ?? "0");
  const url = (JSON.parse(urls) as string[])[index];
  if (!url) throw new Error(`Playwright worker ${index} has no example server`);
  return url;
}
