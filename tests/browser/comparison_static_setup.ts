import { runCaptured } from "../../scripts/verification/process.mjs";
import { createComparisonCatalogue } from "../helpers/comparison_catalogue.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";

import { copiedHost } from "./copied_host.js";

/** Build native Changes once per suite, then discard all source and Git files. */
export async function startComparisonStaticHost(signal?: AbortSignal) {
  return copiedHost(
    "copied-comparison-",
    async (source, output) => {
      await createComparisonCatalogue(source);
      await timeFixturePhase(
        "browser-comparison",
        "static-build",
        false,
        async () => {
          const result = await runCaptured(
            process.execPath,
            [
              `${repositoryRoot}/packages/mokly/bin/mokly.mjs`,
              "build",
              "--base",
              "fixture-base",
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
        },
      );
    },
    signal,
  );
}
