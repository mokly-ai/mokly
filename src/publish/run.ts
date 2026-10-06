import path from "node:path";

import { parseReviewResult } from "@mokly/viewer/data";

import type { BuildDiagnostic } from "../build/build_warnings.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { withPreInstallationCancellation } from "../export/error.js";
import type { exportCatalogue } from "../export/run.js";
import type { GitCommandRunner } from "../review/git.js";

import {
  invalidBundle,
  publishIdentityFailed,
  uncommittedChangesChanged,
} from "./errors.js";
import { exchangeUpload } from "./exchange.js";
import { UPLOAD_MANIFEST, validateUploadManifest } from "./manifest.js";
import { readHeadSha, readUploadIdentity } from "./metadata.js";
import type { RetryDependencies } from "./retry.js";
import { readUploadSnapshot, type UploadSnapshot } from "./snapshot.js";
import type { PublishProgress, PublishResult, UploadOptions } from "./types.js";
import { moklyWorkingPaths, readUncommittedChanges } from "./working_tree.js";

export type { PublishProgress, PublishUploadProgress } from "./types.js";

/** One publication request, including explicitly selected export behavior. */
export interface PublishOptions extends UploadOptions {
  out?: string;
  base?: string;
  noChanges?: boolean;
  onBuildDiagnostics?: (diagnostics: readonly BuildDiagnostic[]) => void;
  repository?: string;
  uploadConcurrency?: number;
  diagnostic?: (message: string) => void;
  incompatibleBaseline?: (commit: string) => void;
}

/** Injectable runtime boundaries for publish orchestration. */
export interface PublishDependencies extends RetryDependencies {
  git: GitCommandRunner;
  export: typeof exportCatalogue;
  fetch: typeof fetch;
  progress?: PublishProgress;
}

/** Export one pinned generation, then exchange its finalized files by digest. */
export async function publishCatalogue(
  config: ResolvedConfig,
  options: PublishOptions,
  version: string,
  env: Readonly<Record<string, string | undefined>>,
  dependencies: PublishDependencies,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const outDir = options.out ?? ".context/mokly-publish";
  const working = moklyWorkingPaths(config, outDir);
  const { identity, uncommittedChanges } = await withProgress(
    dependencies,
    "prepare",
    () =>
      withPreInstallationCancellation(signal, async () => {
        const identity = await readUploadIdentity(
          dependencies.git,
          env,
          options.repository,
        );
        return {
          identity,
          uncommittedChanges: await readUncommittedChanges(
            dependencies.git,
            identity.gitRoot,
            working,
          ),
        };
      }),
  );
  let snapshot: UploadSnapshot | undefined;
  await withProgress(dependencies, "export", () =>
    dependencies.export(config, {
      outDir,
      ...(options.base === undefined ? {} : { base: options.base }),
      ...(signal === undefined ? {} : { signal }),
      noChanges: options.noChanges ?? false,
      ...(options.onBuildDiagnostics
        ? { onBuildDiagnostics: options.onBuildDiagnostics }
        : {}),
      ...(options.diagnostic ? { diagnostic: options.diagnostic } : {}),
      ...(options.incompatibleBaseline
        ? { incompatibleBaseline: options.incompatibleBaseline }
        : {}),
      adapter: {
        publicationMetadata: [UPLOAD_MANIFEST],
        transform(files, routes) {
          const comparisonPath = routes.comparisonUrl?.slice(1) ?? null;
          const reviewBytes = comparisonPath
            ? files.get(comparisonPath)
            : undefined;
          const review =
            reviewBytes === undefined
              ? undefined
              : parseReviewResult(
                  JSON.parse(Buffer.from(reviewBytes).toString("utf8")),
                );
          if (
            (comparisonPath !== null && !review) ||
            files.has(UPLOAD_MANIFEST)
          )
            throw invalidBundle(
              "The export has missing comparison metadata or a reserved manifest path.",
            );
          const manifest = validateUploadManifest({
            schemaVersion: 2,
            moklyVersion: version,
            repository: identity.repository,
            branch: identity.branch,
            headSha: identity.headSha,
            uncommittedChanges,
            pullRequest: identity.pullRequest,
            baseRef: review?.baseRef ?? null,
            baseSha: review?.baseCommit ?? null,
            configPath: toPosixPath(
              path.relative(identity.gitRoot, config.configPath),
            ),
            exportedAt: dependencies.now().toISOString(),
            comparisonPath,
          });
          files.set(UPLOAD_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
        },
      },
      capture: async (files) => {
        snapshot = readUploadSnapshot(files);
      },
    }),
  );
  return withProgress(dependencies, "upload", async () => {
    if ((await readHeadSha(dependencies.git)) !== identity.headSha)
      throw publishIdentityFailed(
        "HEAD changed during export. Retry publication from a stable checkout.",
      );
    if (
      (await readUncommittedChanges(
        dependencies.git,
        identity.gitRoot,
        working,
      )) !== uncommittedChanges
    )
      throw uncommittedChangesChanged();
    if (!snapshot)
      throw invalidBundle("The export did not produce an upload snapshot.");
    return exchangeUpload(snapshot, options, dependencies, signal);
  });
}

async function withProgress<Result>(
  dependencies: PublishDependencies,
  phase: "export" | "prepare" | "upload",
  action: () => Promise<Result>,
): Promise<Result> {
  return dependencies.progress
    ? dependencies.progress.run(phase, action)
    : action();
}
