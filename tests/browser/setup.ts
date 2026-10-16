import path from "node:path";

import type { FullConfig } from "@playwright/test";

import { browserWorkerCount } from "../../scripts/verification/concurrency.mjs";
import {
  timeFixturePhase,
  FULL_CATALOGUE_SETUP_TIMEOUT_MS,
} from "../helpers/fixture_timing.js";

import { exampleReady } from "./example_readiness.js";
import { browserHost, type BrowserHost } from "./hosts.js";

/** Start one isolated example server per parallel worker, without fixed ports. */
export default async function setup(config: FullConfig) {
  const count = browserWorkerCount();
  if (config.workers > count)
    throw new Error("Set MOKLY_PLAYWRIGHT_WORKERS instead of --workers");
  const hosts: BrowserHost[] = [];
  const previous = process.env["MOKLY_PLAYWRIGHT_URLS"];
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      const results = await Promise.allSettled(
        hosts.reverse().map((host) => host.close()),
      );
      if (previous === undefined) delete process.env["MOKLY_PLAYWRIGHT_URLS"];
      else process.env["MOKLY_PLAYWRIGHT_URLS"] = previous;
      const errors = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);
      if (errors.length)
        throw new AggregateError(errors, "Browser host cleanup failed");
    })());
  try {
    const signal = AbortSignal.timeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS);
    await timeFixturePhase(
      "browser-suite",
      "serve-readiness",
      false,
      async () => {
        for (let index = 0; index < count; index++) {
          hosts.push(
            await browserHost(
              process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"]
                ? {
                    kind: "static",
                    directory: path.resolve(
                      process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"]!,
                    ),
                  }
                : { kind: "serve", signal },
            ),
          );
          if (!process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"])
            await exampleReady(hosts[index]!.url, signal);
        }
      },
    );
    process.env["MOKLY_PLAYWRIGHT_URLS"] = JSON.stringify(
      hosts.map((host) => host.url),
    );
    return close;
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Browser setup and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
}
