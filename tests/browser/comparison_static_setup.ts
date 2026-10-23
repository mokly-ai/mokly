import { runCaptured } from "../../scripts/verification/process.mjs";
import {
  createComparisonCatalogue,
  type ComparisonAdditions,
} from "../helpers/comparison_catalogue.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";

import { copiedHost } from "./copied_host.js";

/**
 * Build native Changes once per suite, then discard all source and Git files.
 * `base` names the commit Changes compares with; `HEAD` leaves nothing changed.
 */
export async function startComparisonStaticHost(
  signal?: AbortSignal,
  additions?: ComparisonAdditions,
  fixtureName = "browser-comparison",
  base = "fixture-base",
) {
  return copiedHost(
    "copied-comparison-",
    async (source, output) => {
      await createComparisonCatalogue(source, additions);
      await timeFixturePhase(fixtureName, "static-build", false, async () => {
        const result = await runCaptured(
          process.execPath,
          [
            `${repositoryRoot}/packages/mokly/bin/mokly.mjs`,
            "build",
            "--base",
            base,
            "--out",
            output,
            "--sidecars",
            "1",
            "--strict",
          ],
          { cwd: source, ...(signal ? { signal } : {}) },
        );
        if (result.exitCode !== 0 || result.signal || result.interrupted)
          throw new Error(
            `Comparison fixture build failed: ${result.stderr}\n${result.stdout}`,
          );
      });
    },
    signal,
  );
}
