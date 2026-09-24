import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  MAX_MARKER_BYTES,
  parseCompletionMarker,
  type CacheLayout,
  type CompletionMarker,
} from "./cache_layout.js";
import { BaselineError } from "./errors.js";
import { baselineManifestVersion } from "./manifest.js";
import type { BaselineBuildRequest, BaselineFileSystem } from "./types.js";

/** Incomplete entries are reusable only after a fresh rebuild under their lock. */
export async function completedBaseline(
  fs: BaselineFileSystem,
  layout: CacheLayout,
  request: BaselineBuildRequest,
): Promise<CompletionMarker | undefined> {
  let marker: CompletionMarker | undefined;
  let mockupsPath: unknown;
  try {
    if ((await fs.stat(layout.marker))?.kind !== "regular") return;
    marker = parseCompletionMarker(
      JSON.parse(
        Buffer.from(await fs.read(layout.marker, MAX_MARKER_BYTES)).toString(
          "utf8",
        ),
      ),
      request.commit,
    );
    if (!marker || (await fs.stat(layout.output))?.kind !== "directory") return;
    if (
      (await fs.stat(path.join(layout.entry, "inputs.json")))?.kind !==
      "regular"
    )
      return;
    mockupsPath = JSON.parse(
      Buffer.from(
        await fs.read(path.join(layout.entry, "inputs.json"), MAX_MARKER_BYTES),
      ).toString("utf8"),
    );
    const version = await baselineManifestVersion(
      fs,
      layout.output,
      marker.layout === "generated-v6"
        ? path.join(layout.output, marker.historicalCatalogueRoot!)
        : layout.output,
      request.allowManifestV2,
      request.signal,
    );
    if (version !== marker.manifestVersion) return;
  } catch (error) {
    if (request.signal?.aborted) throw error;
    return;
  }
  if (
    mockupsPath !== request.mockupsPath ||
    !isDeepStrictEqual(marker.commands, request.commands)
  )
    throw new BaselineError(
      "baseline-output-invalid",
      `Cached baseline uses different build settings; remove ${layout.entry} before changing catalogues or commands`,
    );
  return marker;
}

/** Remove partial output and installed dependencies without removing the held lock. */
export async function removePartialBaseline(
  fs: BaselineFileSystem,
  layout: CacheLayout,
): Promise<void> {
  for (const file of [
    layout.marker,
    layout.source,
    layout.output,
    path.join(layout.entry, "inputs.json"),
  ])
    await fs.remove(file);
}
