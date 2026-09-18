import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { test as base } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";

import { servePreviewFixture } from "./preview_fixture.js";
import {
  startOwnedPreviewFixture,
  type OwnedPreviewFixture,
} from "./preview_fixture_owner.js";

const execute = promisify(execFile);

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
        build: (output) =>
          timeFixturePhase("ordinary-preview", "export", false, async () => {
            await execute(
              process.execPath,
              [
                path.join(repositoryRoot, "scripts/preview/build.mjs"),
                "--out",
                output,
              ],
              { cwd: repositoryRoot, maxBuffer: 16 * 1_024 * 1_024 },
            );
          }),
        contextRoot: path.join(repositoryRoot, ".context"),
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
    { scope: "worker", timeout: 90_000 },
  ],
});
