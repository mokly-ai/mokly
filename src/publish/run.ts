import path from "node:path";

import { parseReviewResult } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  EXPORT_MARKER,
  parseExportOwnership,
  type ExportOwnership,
} from "../export/ownership.js";
import type { exportCatalogue } from "../export/run.js";
import type { GitCommandRunner } from "../review/git.js";

import { uploadMissingBlobs, type UploadBlob } from "./blobs.js";
import { validateUploadFiles } from "./bundle.js";
import { completeUpload } from "./complete.js";
import { uploadFailed } from "./http.js";
import { UPLOAD_MANIFEST, validateUploadManifest } from "./manifest.js";
import { readHeadSha, readUploadIdentity } from "./metadata.js";
import { buildPlanArchive, requestUploadPlan } from "./plan.js";
import { ReplanRequired, type RetryDependencies } from "./retry.js";
import type { PublishResult, UploadManifest, UploadOptions } from "./types.js";

/** One publication request, including explicitly selected export behavior. */
export interface PublishOptions extends UploadOptions {
  out?: string;
  base?: string;
  noChanges?: boolean;
  repository?: string;
  uploadConcurrency?: number;
  diagnostic?: (message: string) => void;
}

/** Injectable runtime boundaries for publish orchestration. */
export interface PublishDependencies extends RetryDependencies {
  git: GitCommandRunner;
  export: typeof exportCatalogue;
  fetch: typeof fetch;
  progress?: PublishProgress;
}

/** Optional command-presentation observer around publication work. */
export interface PublishProgress {
  run<Result>(
    phase: "export" | "prepare" | "upload",
    action: () => Promise<Result>,
  ): Promise<Result>;
  update?(progress: PublishUploadProgress): void;
}

/** One round's requested blob count, completed count and total byte size. */
export interface PublishUploadProgress {
  completed: number;
  total: number;
  totalBytes: number;
}

interface UploadSnapshot {
  files: Map<string, Buffer>;
  manifest: UploadManifest;
  ownership: ExportOwnership;
  blobs: Map<string, UploadBlob>;
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
  const identity = await withProgress(dependencies, "prepare", () =>
    readUploadIdentity(dependencies.git, env, options.repository),
  );
  let snapshot: UploadSnapshot | undefined;
  await withProgress(dependencies, "export", () =>
    dependencies.export(config, {
      outDir: options.out ?? ".context/mokly-publish",
      ...(options.base === undefined ? {} : { base: options.base }),
      ...(signal === undefined ? {} : { signal }),
      noChanges: options.noChanges ?? false,
      ...(options.diagnostic ? { diagnostic: options.diagnostic } : {}),
      adapter: {
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
            schemaVersion: 1,
            moklyVersion: version,
            repository: identity.repository,
            branch: identity.branch,
            headSha: identity.headSha,
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
        snapshot = readSnapshot(files);
      },
    }),
  );
  return withProgress(dependencies, "upload", async () => {
    if ((await readHeadSha(dependencies.git)) !== identity.headSha)
      throw new MoklyError(
        "git-failed",
        "HEAD changed during export. Retry publication from a stable checkout.",
      );
    if (!snapshot)
      throw invalidBundle("The export did not produce an upload snapshot.");
    return exchange(snapshot, options, dependencies, signal);
  });
}

async function exchange(
  snapshot: UploadSnapshot,
  options: PublishOptions,
  dependencies: PublishDependencies,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const archive = await buildPlanArchive(
    snapshot.files,
    snapshot.manifest,
    signal,
  );
  const digests = new Set(snapshot.ownership.files.map(({ sha256 }) => sha256));
  const uploadedDigests = new Set<string>();
  let replanned = false;
  let showedBlobProgress = false;
  while (true) {
    const plan = await requestUploadPlan(
      options,
      archive,
      digests,
      dependencies,
      signal,
    );
    try {
      const requested = plan.missing.map((digest) => {
        const blob = snapshot.blobs.get(digest);
        if (!blob)
          throw invalidBundle(
            "The upload plan requested a file outside the finalized export.",
          );
        return blob;
      });
      let completedCount = 0;
      const totalBytes = requested.reduce(
        (total, blob) => total + blob.size,
        0,
      );
      if (requested.length > 0) {
        showedBlobProgress = true;
        dependencies.progress?.update?.({
          completed: completedCount,
          total: requested.length,
          totalBytes,
        });
      } else if (showedBlobProgress) {
        dependencies.progress?.update?.({
          completed: 0,
          total: 0,
          totalBytes: 0,
        });
      }
      const uploaded = await uploadMissingBlobs(
        plan,
        snapshot.blobs,
        options,
        options.uploadConcurrency ?? 8,
        dependencies,
        signal,
        (digest) => {
          uploadedDigests.add(digest);
          completedCount++;
          dependencies.progress?.update?.({
            completed: completedCount,
            total: requested.length,
            totalBytes,
          });
        },
      );
      for (const digest of uploaded) uploadedDigests.add(digest);
      const completion = await completeUpload(
        plan,
        options,
        dependencies,
        signal,
      );
      const uploadedEntries = snapshot.ownership.files.filter(({ sha256 }) =>
        uploadedDigests.has(sha256),
      ).length;
      return {
        ...completion,
        uploaded: uploadedEntries,
        unchanged: snapshot.ownership.files.length - uploadedEntries,
      };
    } catch (error) {
      if (!(error instanceof ReplanRequired)) throw error;
      if (replanned) throw uploadFailed();
      replanned = true;
    }
  }
}

function readSnapshot(
  contents: ReadonlyMap<string, string | Uint8Array>,
): UploadSnapshot {
  const files = validateUploadFiles(contents);
  const markerBytes = files.get(EXPORT_MARKER);
  if (!markerBytes)
    throw invalidBundle("The export ownership marker is missing.");
  const parsed = parseExportOwnership(markerBytes.toString("utf8"));
  if (parsed.kind === "unsupported-version")
    throw new MoklyError(
      "upload-unsupported-version",
      "The export ownership version is not supported for publication.",
    );
  if (parsed.kind === "invalid")
    throw invalidBundle("The export ownership marker is invalid.");
  if (parsed.value.files.length + 1 !== files.size)
    throw invalidBundle("The export ownership inventory is incomplete.");
  const blobs = new Map<string, UploadBlob>();
  const ownedPaths = new Set<string>();
  for (const entry of parsed.value.files) {
    ownedPaths.add(entry.path);
    const bytes = files.get(entry.path);
    if (!bytes || bytes.length !== entry.size)
      throw invalidBundle("The export does not match its ownership inventory.");
    const previous = blobs.get(entry.sha256);
    if (
      previous &&
      (previous.size !== entry.size || !previous.bytes.equals(bytes))
    )
      throw invalidBundle("The export has conflicting content digests.");
    blobs.set(entry.sha256, { ...entry, bytes });
  }
  for (const name of files.keys()) {
    if (name !== EXPORT_MARKER && !ownedPaths.has(name))
      throw invalidBundle("The export ownership inventory is incomplete.");
  }
  const manifestBytes = files.get(UPLOAD_MANIFEST);
  if (!manifestBytes) throw invalidBundle("The upload manifest is missing.");
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw invalidBundle("The upload manifest is invalid.");
  }
  return {
    files,
    manifest: validateUploadManifest(manifestValue),
    ownership: parsed.value,
    blobs,
  };
}

function invalidBundle(message: string): MoklyError {
  return new MoklyError("upload-invalid-bundle", message);
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
