import path from "node:path";

import { test as base } from "@playwright/test";

import { NodeBaselineProcessRunner } from "../../dist/baseline/process.js";
import { repositoryRoot } from "../helpers/fixture.js";
import {
  FULL_CATALOGUE_SETUP_TIMEOUT_MS,
  timeFixturePhase,
} from "../helpers/fixture_timing.js";

import { servePreviewFixture } from "./preview_fixture.js";
import {
  previewFixtureContextRoot,
  startOwnedPreviewFixture,
  type OwnedPreviewFixture,
} from "./preview_fixture_owner.js";

interface OrdinaryPreviewWorkerFixtures {
  readonly ordinaryPreview: OwnedPreviewFixture;
}

/** Playwright test type sharing one prepared ordinary publication per worker. */
export const test = base.extend<
  Record<never, never>,
  OrdinaryPreviewWorkerFixtures
>({
  ordinaryPreview: [
    async ({ browserName: _browserName }, use, workerInfo) => {
      const preview = await startOwnedPreviewFixture({
        artifactRelative: ".context/site",
        build: (output) =>
          timeFixturePhase("ordinary-preview", "export", false, () =>
            prepareOrdinaryPreview(output),
          ),
        contextRoot: previewFixtureContextRoot(
          path.join(repositoryRoot, ".context"),
        ),
        prefix: `mokly-preview-worker-${workerInfo.workerIndex}-`,
        serve: (artifact) =>
          timeFixturePhase("ordinary-preview", "serve", false, () =>
            servePreviewFixture(artifact),
          ),
      });
      try {
        await use(preview);
      } finally {
        await preview.close();
      }
    },
    { scope: "worker", timeout: FULL_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
});

/** Keep React's artifact rendering outside Playwright's expanded debug stacks. */
async function prepareOrdinaryPreview(output: string): Promise<void> {
  const result = await new NodeBaselineProcessRunner().run({
    argv: [
      process.execPath,
      "--import",
      "tsx",
      path.join(repositoryRoot, "tests/helpers/ordinary_preview_worker.mjs"),
      output,
    ],
    cwd: repositoryRoot,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    signal: AbortSignal.timeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS - 10_000),
  });
  if (result.exitCode !== 0 || result.signal !== null)
    throw new Error(`Ordinary preview preparation failed: ${result.output}`);
}
