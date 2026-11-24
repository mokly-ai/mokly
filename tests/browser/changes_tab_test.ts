/**
 * A `test` whose `baseURL` serves an immutable static build of the Changes
 * tab catalogue of `tests/helpers/changes_tab_catalogue.ts`, built with its
 * Changes once per worker. The source repository is removed before requests
 * start, so the host serves only the copied output.
 */

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { runCaptured } from "../../scripts/verification/process.mjs";
import {
  changesTabBase,
  createChangesTabCatalogue,
} from "../helpers/changes_tab_catalogue.js";
import { repositoryRoot } from "../helpers/fixture.js";
import {
  ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS,
  timeFixturePhase,
} from "../helpers/fixture_timing.js";

import { test as browserTest } from "./browser_test.js";
import { copiedHost } from "./copied_host.js";

export {
  changesTabPaths,
  tourSteps,
} from "../helpers/changes_tab_catalogue.js";

type Copy = Awaited<ReturnType<typeof copiedHost>>;

/** Build the catalogue with its Changes, then serve only the copied output. */
function startChangesTabHost(signal: AbortSignal): Promise<Copy> {
  return copiedHost(
    "changes-tab-",
    async (source, output) => {
      await createChangesTabCatalogue(source);
      await timeFixturePhase("changes-tab", "static-build", false, async () => {
        const result = await runCaptured(
          process.execPath,
          [
            `${repositoryRoot}/packages/mokly/bin/mokly.mjs`,
            "build",
            "--base",
            changesTabBase,
            "--out",
            output,
            "--sidecars",
            "1",
            "--strict",
          ],
          { cwd: source, signal },
        );
        if (result.exitCode !== 0 || result.signal || result.interrupted)
          throw new Error(
            `Changes tab fixture build failed: ${result.stderr}\n${result.stdout}`,
          );
      });
    },
    signal,
  );
}

export const test = browserTest.extend<object, { changesTabCopy: Copy }>({
  changesTabCopy: [
    async ({ browserName }, use) => {
      void browserName;
      const copy = await startChangesTabHost(
        AbortSignal.timeout(ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS),
      );
      ownBrowserCleanup(copy.close);
      try {
        await use(copy);
      } finally {
        await copy.close();
      }
    },
    { scope: "worker", timeout: ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
  baseURL: async ({ changesTabCopy }, use) => {
    await use(changesTabCopy.url);
  },
});
