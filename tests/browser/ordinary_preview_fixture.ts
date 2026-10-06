import path from "node:path";

import { test as base } from "@playwright/test";

import { buildPreview } from "../../scripts/preview/catalogue.mjs";
import { createCommittedExampleBaseline } from "../helpers/example_baseline.js";
import { repositoryRoot } from "../helpers/fixture.js";
import {
  PREVIEW_BUILD_SETUP_TIMEOUT_MS,
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
          timeFixturePhase("ordinary-preview", "export", false, async () => {
            const fixtureRoot = path.dirname(path.dirname(output));
            const config = await createCommittedExampleBaseline(
              fixtureRoot,
              "ordinary-preview",
            );
            await buildPreview(config, output);
          }),
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
    { scope: "worker", timeout: PREVIEW_BUILD_SETUP_TIMEOUT_MS },
  ],
});
