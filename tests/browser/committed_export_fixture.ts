import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test as base } from "@playwright/test";

import type { BaselineBuilder } from "../../dist/baseline/types.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import { exportCatalogue } from "../../dist/export/run.js";
import { CommittedBaselineReader } from "../../dist/review/committed.js";
import { prepareReviewRepository } from "../../dist/review/prepare.js";
import { createCommittedExampleBaseline } from "../helpers/example_baseline.js";
import { repositoryRoot } from "../helpers/fixture.js";
import {
  FULL_CATALOGUE_SETUP_TIMEOUT_MS,
  timeFixturePhase,
} from "../helpers/fixture_timing.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { assertServedShellMarker } from "./export_shell.js";
import {
  previewFixtureContextRoot,
  startOwnedPreviewFixture,
  type OwnedPreviewFixture,
} from "./preview_fixture_owner.js";

const execute = promisify(execFile);
const committedBaselineBuilder: BaselineBuilder = {
  async build() {
    throw new Error(
      "Committed-output export fixtures must not rebuild their baseline",
    );
  },
};

interface CommittedExportOptions {
  readonly profile: "static-example" | "design-library";
  readonly prefix: string;
  readonly shellPath: string;
  readonly editSource?: (root: string) => Promise<void>;
}

interface CommittedExportBaseline {
  readonly config: ResolvedConfig;
  readonly commit: string;
}

interface CommittedExportFixture
  extends OwnedPreviewFixture, CommittedExportBaseline {
  readonly server: Awaited<ReturnType<typeof serveStaticFiles>>;
}

interface CommittedExportWorkerFixtures {
  readonly committedExport: CommittedExportFixture;
}

/** Share one committed-output export and its static server per browser worker. */
export function committedExportTest(options: CommittedExportOptions) {
  return base.extend<Record<never, never>, CommittedExportWorkerFixtures>({
    committedExport: [
      async ({ browserName: _browserName }, use, workerInfo) => {
        const fixture = await startCommittedExportFixture({
          ...options,
          prefix: `${options.prefix}${workerInfo.workerIndex}-`,
        });
        try {
          await use(fixture);
        } finally {
          await fixture.close();
        }
      },
      { scope: "worker", timeout: FULL_CATALOGUE_SETUP_TIMEOUT_MS },
    ],
  });
}

async function startCommittedExportFixture(
  options: CommittedExportOptions,
): Promise<CommittedExportFixture> {
  const fixtureName =
    options.profile === "static-example"
      ? "static-example"
      : "design-library-export";
  let baseline: CommittedExportBaseline | undefined;
  let server: CommittedExportFixture["server"] | undefined;
  const fixture = await startOwnedPreviewFixture({
    artifactRelative: ".context/site",
    contextRoot: previewFixtureContextRoot(
      path.join(repositoryRoot, ".context"),
    ),
    prefix: options.prefix,
    build: async (output) => {
      const root = path.dirname(path.dirname(output));
      const prepared = await timeFixturePhase(
        fixtureName,
        "baseline",
        false,
        async () => {
          const config = await createCommittedExampleBaseline(
            root,
            options.profile,
          );
          const { stdout } = await execute("git", ["rev-parse", "HEAD"], {
            cwd: root,
          });
          const commit = stdout.trim();
          const review = await prepareReviewRepository(config, "HEAD", {
            builder: committedBaselineBuilder,
          });
          expect(review.selection).toBe("blobs");
          expect(review.reader).toBeInstanceOf(CommittedBaselineReader);
          return { config, commit };
        },
      );
      baseline = prepared;
      await options.editSource?.(root);
      await timeFixturePhase(fixtureName, "export", false, async () => {
        await exportCatalogue(prepared.config, {
          base: "HEAD",
          outDir: output,
          signal: AbortSignal.timeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS),
        });
      });
    },
    serve: async (artifact) => {
      server = await timeFixturePhase(fixtureName, "serve", false, () =>
        serveStaticFiles(artifact),
      );
      return server;
    },
  });
  try {
    assert.ok(baseline);
    assert.ok(server);
    await assertServedShellMarker(fixture.url, options.shellPath);
    return { ...fixture, ...baseline, server };
  } catch (error) {
    try {
      await fixture.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Committed export setup and cleanup failed",
        { cause: cleanupError },
      );
    }
    throw error;
  }
}
