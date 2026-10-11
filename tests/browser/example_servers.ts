import {
  browserWorkerCount,
  type ConcurrencyEnvironment,
} from "../../scripts/verification/concurrency.mjs";

/** First example server port when `MOKLY_PLAYWRIGHT_PORT` is unset. */
const DEFAULT_FIRST_PORT = "4517";

/**
 * One example server per Playwright worker on consecutive ports, so on-demand
 * page renders in one worker never queue behind another worker's renders.
 */
export function exampleServerPorts(
  env: ConcurrencyEnvironment = process.env,
): number[] {
  const configured = env["MOKLY_PLAYWRIGHT_PORT"] ?? DEFAULT_FIRST_PORT;
  const first = Number(configured);
  const count = browserWorkerCount(env);
  if (!Number.isSafeInteger(first) || first < 1 || first + count - 1 > 65_535)
    throw new Error(
      `MOKLY_PLAYWRIGHT_PORT must start ${count} consecutive available TCP port(s); received ${configured}`,
    );
  return Array.from({ length: count }, (_, offset) => first + offset);
}

/**
 * The example server command for one port. `--base HEAD` compares with the
 * checked-out commit, so results depend only on the tree under test.
 */
export function exampleServerCommand(port: number): string {
  return `node dist/cli/bin.js serve --config examples/basic/mokly.config.ts --base HEAD --port ${port} --no-watch`;
}

/** The server port the current worker owns; the runner process uses the first. */
export function ownExampleServerPort(
  ports: readonly number[],
  env: ConcurrencyEnvironment = process.env,
): number {
  const index = Number(env["TEST_PARALLEL_INDEX"] ?? "0");
  const port = ports[index];
  if (port === undefined)
    throw new Error(
      `Playwright worker ${index} has no example server; set MOKLY_PLAYWRIGHT_WORKERS instead of passing --workers`,
    );
  return port;
}
