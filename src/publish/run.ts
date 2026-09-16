import path from "node:path";

import { parseReviewResult } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import type { exportCatalogue } from "../export/run.js";
import type { GitCommandRunner } from "../review/git.js";

import { bundleUpload } from "./bundle.js";
import { uploadCatalogue } from "./http.js";
import { UPLOAD_MANIFEST, validateUploadManifest } from "./manifest.js";
import { readHeadSha, readUploadIdentity } from "./metadata.js";
import type { UploadOptions } from "./types.js";

/** One publication request, including explicitly selected export behavior. */
export interface PublishOptions extends UploadOptions {
  out?: string;
  base?: string;
  noChanges?: boolean;
  repository?: string;
}

/** Injectable runtime boundaries for publish orchestration. */
export interface PublishDependencies {
  git: GitCommandRunner;
  export: typeof exportCatalogue;
  fetch: typeof fetch;
  now(): Date;
}

/** Export one pinned generation, then send exactly its finalized archive bytes. */
export async function publishCatalogue(
  config: ResolvedConfig,
  options: PublishOptions,
  version: string,
  env: Readonly<Record<string, string | undefined>>,
  dependencies: PublishDependencies,
  signal?: AbortSignal,
): Promise<void> {
  const identity = await readUploadIdentity(
    dependencies.git,
    env,
    options.repository,
  );
  let bundle: Buffer | undefined;
  await dependencies.export(config, {
    outDir: options.out ?? ".context/mokly-publish",
    ...(options.base === undefined ? {} : { base: options.base }),
    ...(signal === undefined ? {} : { signal }),
    noChanges: options.noChanges ?? false,
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
        if ((comparisonPath !== null && !review) || files.has(UPLOAD_MANIFEST))
          throw new MoklyError(
            "upload-invalid-bundle",
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
      bundle = await bundleUpload(files, signal);
    },
  });
  if ((await readHeadSha(dependencies.git)) !== identity.headSha)
    throw new MoklyError(
      "git-failed",
      "HEAD changed during export. Retry publication from a stable checkout.",
    );
  if (!bundle)
    throw new MoklyError(
      "upload-invalid-bundle",
      "The export did not produce an upload bundle.",
    );
  await uploadCatalogue(options, bundle, dependencies.fetch, signal);
}
