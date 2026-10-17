import path from "node:path";

import type { FullConfig } from "@playwright/test";

import { browserWorkerCount } from "../../scripts/verification/concurrency.mjs";
import {
  timeFixturePhase,
  FULL_CATALOGUE_SETUP_TIMEOUT_MS,
} from "../helpers/fixture_timing.js";

import { startCopiedStaticHost } from "./copied_static_setup.js";
import { startExampleHosts } from "./example_setup.js";
import { browserHost, type BrowserHost } from "./hosts.js";

/** Start one isolated example server per parallel worker, without fixed ports. */
export default async function setup(
  config: FullConfig,
  dependencies = {
    start: startExampleHosts,
    host: browserHost,
    staticHost: startCopiedStaticHost,
  },
) {
  const count = browserWorkerCount();
  if (config.workers > count)
    throw new Error("Set MOKLY_PLAYWRIGHT_WORKERS instead of --workers");
  const hosts: BrowserHost[] = [];
  const previous = process.env["MOKLY_PLAYWRIGHT_URLS"];
  const staticNames = [
    "MOKLY_PLAYWRIGHT_COPIED_URL",
    "MOKLY_PLAYWRIGHT_COPIED_DIR",
  ] as const;
  const previousStatic = staticNames.map((name) => process.env[name]);
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      const results = await Promise.allSettled(
        hosts.reverse().map((host) => host.close()),
      );
      if (previous === undefined) delete process.env["MOKLY_PLAYWRIGHT_URLS"];
      else process.env["MOKLY_PLAYWRIGHT_URLS"] = previous;
      staticNames.forEach((name, index) => {
        if (previousStatic[index] === undefined) delete process.env[name];
        else process.env[name] = previousStatic[index];
      });
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
        const directory =
          process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"] ??
          process.env["MOKLY_PLAYWRIGHT_FILE_DIR"];
        if (directory) {
          // One plain static host can serve every read-only worker.
          const host = await dependencies.host({
            kind: "static",
            directory: path.resolve(directory),
          });
          hosts.push(...Array.from({ length: count }, () => host));
        } else hosts.push(...(await dependencies.start(count, signal)));
      },
    );
    const copied = await dependencies.staticHost(signal);
    const urls = hosts.map((host) => host.url);
    hosts.push(copied);
    process.env["MOKLY_PLAYWRIGHT_COPIED_URL"] = copied.url;
    process.env["MOKLY_PLAYWRIGHT_COPIED_DIR"] = copied.directory;
    process.env["MOKLY_PLAYWRIGHT_URLS"] = JSON.stringify(urls);
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
