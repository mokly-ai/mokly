import { repositoryRoot } from "../helpers/fixture.js";

import { exampleReady } from "./example_readiness.js";
import { exampleServerCommand } from "./example_servers.js";
import { serveHost, type BrowserHost } from "./hosts.js";

/** Start each worker independently, retaining every host until all work settles. */
export async function startExampleHosts(
  count: number,
  cancellation: AbortSignal,
  start = serveHost,
  ready = exampleReady,
): Promise<BrowserHost[]> {
  const abort = new AbortController();
  const signal = AbortSignal.any([cancellation, abort.signal]);
  const hosts: BrowserHost[] = [];
  const outcomes = await Promise.allSettled(
    Array.from({ length: count }, async (_, index) => {
      try {
        const host = await start(
          exampleServerCommand(),
          repositoryRoot,
          signal,
        );
        hosts[index] = {
          ...host,
          async close() {
            await host.close();
            if (host.diagnostics)
              validateExampleDiagnostics(host.diagnostics());
          },
        };
        await ready(host.url, signal);
      } catch (error) {
        abort.abort(error);
        throw error;
      }
    }),
  );
  const errors = outcomes
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (errors.length) {
    const cleanup = await Promise.allSettled(hosts.map((host) => host.close()));
    errors.push(
      ...cleanup
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason),
    );
    throw new AggregateError(errors, "Example worker setup failed");
  }
  return hosts;
}

/** The invalid shared base emits one diagnostic and has no real Changes work. */
export function validateExampleDiagnostics(output: string): void {
  if ((output.match(/\[mokly\/git-failed\]/g) ?? []).length !== 1)
    throw new Error(`Expected one shared example Git diagnostic:\n${output}`);
}
