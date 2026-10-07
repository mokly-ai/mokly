import path from "node:path";

import type { Compilation } from "../build/compile.js";
import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";
import { projectRealPath, toPosixPath } from "../config/paths.js";
import { isCancellation, isMoklyError, MoklyError } from "../errors.js";
import { gitBlobHash } from "../registry/blob_hash.js";
import type { GitCommandRunner } from "../review/git.js";
import { GitProcessError } from "../review/git_process.js";

import type { PublishCheckoutPaths } from "./checkout.js";
import { checkoutFailure } from "./checkout_errors.js";

/** Generated roots and the committed paths that select committed output. */
export interface PublishGeneratedState {
  readonly prefixes: readonly string[];
  readonly tracked: readonly string[];
  readonly ignoreRules: readonly string[];
}

/** Read committed output membership and require ignored output in derived mode. */
export async function readPublishGeneratedState(
  runner: GitCommandRunner,
  paths: PublishCheckoutPaths,
): Promise<PublishGeneratedState> {
  const roots = [...new Set(paths.generated.map(projectRealPath))];
  const prefixes = [
    ...new Set(
      roots.map((root) => toPosixPath(path.relative(paths.gitRoot, root))),
    ),
  ];
  const tracked = (
    await runner.run([
      "ls-files",
      "--cached",
      "--full-name",
      "-z",
      "--",
      ...prefixes.map((prefix) => `:(top,literal)${prefix}`),
    ])
  )
    .split("\0")
    .filter(Boolean);
  const ignoreRules: string[] = [];
  if (!tracked.length) {
    for (const [index, root] of roots.entries()) {
      try {
        await runner.run([
          "check-ignore",
          "--no-index",
          "--quiet",
          "--",
          `${root}/`,
        ]);
      } catch (error) {
        if (isCancellation(error)) throw error;
        if (!(error instanceof GitProcessError) || error.exitCode !== 1)
          throw new MoklyError(
            "git-failed",
            "Could not read the generated output ignore rules.",
          );
        const prefix = prefixes[index]!.replace(/[\\*?[\]]/g, "\\$&");
        ignoreRules.push(`/${prefix}/`);
      }
    }
  }
  return { prefixes, tracked, ignoreRules };
}

/** Compare compiled bytes with committed blob identities without reading historical blobs. */
export async function assertCommittedGeneration(
  runner: GitCommandRunner,
  head: string,
  state: PublishGeneratedState,
  compilation: Compilation,
): Promise<void> {
  if (!state.tracked.length) return;
  const prefix = state.prefixes.find((root) =>
    state.tracked.some((name) => name === root || name.startsWith(`${root}/`)),
  )!;
  const expected = new Map<string, GeneratedFile>(
    [...compilation.outputs].map(
      ([route, bytes]) => [`${prefix}/${route}`, bytes] as const,
    ),
  );
  const committed = await committedFiles(runner, head, state.prefixes);
  const format = head.length === 64 ? "sha256" : "sha1";
  const stale = [...expected]
    .filter(([name, bytes]) => {
      const file = committed.get(name);
      return (
        !file?.regular ||
        file.objectId !== gitBlobHash(generatedBytes(bytes), format)
      );
    })
    .map(([name]) => name);
  const extras = state.tracked.filter((name) => !expected.has(name));
  if (stale.length || extras.length)
    throw checkoutFailure("build-stale", [...stale, ...extras]);
}

/** Read only mode and object identity; publication's byte limits stay independent. */
async function committedFiles(
  runner: GitCommandRunner,
  head: string,
  prefixes: readonly string[],
): Promise<ReadonlyMap<string, { regular: boolean; objectId: string }>> {
  let output: string;
  try {
    output = await runner.run([
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      head,
      "--",
      ...prefixes.map((prefix) => `:(top,literal)${prefix}`),
    ]);
  } catch (error) {
    if (isCancellation(error) || isMoklyError(error)) throw error;
    throw new MoklyError(
      "git-failed",
      "Could not read committed generated files.",
    );
  }
  const files = new Map<string, { regular: boolean; objectId: string }>();
  for (const record of output.split("\0")) {
    if (!record) continue;
    const separator = record.indexOf("\t");
    const [mode, kind, objectId] = record.slice(0, separator).split(" ");
    files.set(record.slice(separator + 1), {
      regular: kind === "blob" && /^100[0-7]{3}$/.test(mode ?? ""),
      objectId: objectId ?? "",
    });
  }
  return files;
}
