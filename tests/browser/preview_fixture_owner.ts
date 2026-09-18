import fs from "node:fs/promises";
import path from "node:path";

export const PREVIEW_ARTIFACT_MARKER = ".mokly-preview-artifact";

const PREVIEW_ARTIFACT_MARKER_CONTENTS = "schemaVersion=1\n";
const FILESYSTEM_TIMESTAMP_TOLERANCE_MS = 2_000;

/** Setup failure proving a live endpoint may still own the artifact path. */
export class PreviewOutputRetentionError extends AggregateError {
  constructor(errors: readonly unknown[], message: string, cause: unknown) {
    super(errors, message, { cause });
    this.name = "PreviewOutputRetentionError";
  }
}

/** Endpoint serving one static preview artifact. */
export interface PreviewEndpoint {
  readonly url: string;
  close(): Promise<void>;
}

/** Evidence that a unique output was created by the current setup operation. */
export interface PreviewArtifactFreshness {
  readonly markerModifiedAtMs: number;
  readonly outputWasAbsent: true;
  readonly preparationStartedAtMs: number;
}

/** Preview endpoint and writable paths owned by one worker fixture. */
export interface OwnedPreviewFixture extends PreviewEndpoint {
  readonly artifact: string;
  readonly freshness: PreviewArtifactFreshness;
  readonly ownerRoot: string;
}

interface OwnedPreviewOptions {
  readonly build: (artifact: string) => Promise<void>;
  readonly contextRoot: string;
  readonly prefix: string;
  readonly serve: (artifact: string) => Promise<PreviewEndpoint>;
}

/** Prepare, validate and serve a unique artifact with failure-safe ownership. */
export async function startOwnedPreviewFixture(
  options: OwnedPreviewOptions,
): Promise<OwnedPreviewFixture> {
  await fs.mkdir(options.contextRoot, { recursive: true });
  const ownerRoot = await fs.mkdtemp(
    path.join(options.contextRoot, options.prefix),
  );
  const artifact = path.join(ownerRoot, "site");
  const preparationStartedAtMs = Date.now();
  let endpoint: PreviewEndpoint | undefined;
  try {
    await assertMissing(artifact);
    await options.build(artifact);
    const freshness = await artifactFreshness(artifact, preparationStartedAtMs);
    endpoint = await options.serve(artifact);
    let teardown: Promise<void> | undefined;
    return {
      artifact,
      freshness,
      ownerRoot,
      url: endpoint.url,
      close() {
        teardown ??= closeAndRemove(endpoint, ownerRoot);
        return teardown;
      },
    };
  } catch (error) {
    if (error instanceof PreviewOutputRetentionError) throw error;
    return cleanupAfterFailure(error, endpoint, ownerRoot);
  }
}

async function assertMissing(artifact: string): Promise<void> {
  try {
    await fs.lstat(artifact);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`preview artifact output was not fresh: ${artifact}`);
}

async function artifactFreshness(
  artifact: string,
  preparationStartedAtMs: number,
): Promise<PreviewArtifactFreshness> {
  const output = await fs.lstat(artifact);
  if (!output.isDirectory() || output.isSymbolicLink())
    throw new Error("preview artifact output is not a real directory");
  const markerPath = path.join(artifact, PREVIEW_ARTIFACT_MARKER);
  const marker = await fs.lstat(markerPath);
  if (!marker.isFile() || marker.isSymbolicLink())
    throw new Error("preview artifact marker is not a regular file");
  if (
    (await fs.readFile(markerPath, "utf8")) !== PREVIEW_ARTIFACT_MARKER_CONTENTS
  )
    throw new Error("preview artifact marker has unexpected contents");
  if (
    marker.mtimeMs <
    preparationStartedAtMs - FILESYSTEM_TIMESTAMP_TOLERANCE_MS
  )
    throw new Error("preview artifact marker predates preparation");
  return {
    markerModifiedAtMs: marker.mtimeMs,
    outputWasAbsent: true,
    preparationStartedAtMs,
  };
}

async function closeAndRemove(
  endpoint: PreviewEndpoint | undefined,
  ownerRoot: string,
): Promise<void> {
  await endpoint?.close();
  await fs.rm(ownerRoot, { force: true, recursive: true });
}

async function cleanupAfterFailure(
  failure: unknown,
  endpoint: PreviewEndpoint | undefined,
  ownerRoot: string,
): Promise<never> {
  try {
    await closeAndRemove(endpoint, ownerRoot);
  } catch (cleanupFailure) {
    throw new AggregateError(
      [failure, cleanupFailure],
      "preview setup and cleanup failed",
      { cause: cleanupFailure },
    );
  }
  throw failure;
}
