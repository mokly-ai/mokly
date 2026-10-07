import type { FullConfig } from "@playwright/test";

import {
  VERIFICATION_OWNER_ID_ENV,
  VERIFICATION_PROCESS_REGISTRY_ENV,
  VERIFICATION_RESOURCE_ROOT_ENV,
} from "../../dist/baseline/process_owner.js";
import { reportBrowserStartup } from "../helpers/browser_timing.js";
import { SHARED_EXAMPLE_DESCRIPTOR_ENV } from "../helpers/example_descriptor.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";
import {
  prepareSharedExample,
  sharedExampleEnvironment,
} from "../helpers/shared_example.js";
import type { SharedExample } from "../helpers/shared_example.js";
import { waitForInitialChanges } from "../helpers/watched_catalogue.js";

import { exampleServerPorts } from "./example_servers.js";

const environmentKeys = [
  VERIFICATION_OWNER_ID_ENV,
  VERIFICATION_PROCESS_REGISTRY_ENV,
  VERIFICATION_RESOURCE_ROOT_ENV,
  SHARED_EXAMPLE_DESCRIPTOR_ENV,
] as const;

/** One prepared baseline per invocation, published only after real validation and drainage. */
export default async function setup(
  config: FullConfig,
): Promise<() => Promise<void>> {
  const ports = exampleServerPorts();
  if (config.workers > ports.length)
    throw new Error(
      `Playwright runs ${config.workers} workers but starts ${ports.length} example server(s); set MOKLY_PLAYWRIGHT_WORKERS=${config.workers} instead of passing --workers`,
    );
  const previous = new Map(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  const restore = () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  let shared: SharedExample | undefined;
  try {
    await timeFixturePhase("browser-suite", "global-setup", false, async () => {
      await timeFixturePhase("browser-suite", "serve-readiness", false, () =>
        Promise.all(
          ports.map((port) =>
            waitForInitialChanges(`http://127.0.0.1:${port}`, 180_000),
          ),
        ),
      );
      shared = await prepareSharedExample();
      shared.signal.throwIfAborted();
      const environment = sharedExampleEnvironment(shared);
      for (const key of environmentKeys) process.env[key] = environment[key]!;
    });
    reportBrowserStartup();
  } catch (error) {
    const failures: unknown[] = [error];
    await shared?.close().catch((cleanup: unknown) => {
      failures.push(cleanup);
    });
    restore();
    if (failures.length > 1)
      throw new AggregateError(failures, "Browser setup and cleanup failed", {
        cause: error,
      });
    throw error;
  }
  let closing: Promise<void> | undefined;
  return () => {
    closing ??= timeFixturePhase(
      "browser-suite",
      "global-teardown",
      false,
      async () => {
        try {
          await shared!.close();
        } finally {
          restore();
        }
      },
    );
    return closing;
  };
}
