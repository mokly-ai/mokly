import path from "node:path";

import { runCaptured } from "../../scripts/verification/process.mjs";

import { repositoryRoot } from "./fixture.js";
import { timeFixturePhase } from "./fixture_timing.js";

/** Build real published documents through the same shim used by consumers. */
export async function buildStaticCatalogue(
  cwd: string,
  output: string,
): Promise<void> {
  await timeFixturePhase(
    "browser-catalogue",
    "static-build",
    false,
    async () => {
      const result = await runCaptured(
        process.execPath,
        [
          path.join(repositoryRoot, "packages/mokly/bin/mokly.mjs"),
          "build",
          "--no-changes",
          "--out",
          output,
          "--sidecars",
          "1",
        ],
        { cwd },
      );
      if (result.exitCode !== 0 || result.signal || result.interrupted)
        throw new Error(
          `Fixture build failed: ${result.stderr}\n${result.stdout}`,
        );
    },
  );
}
