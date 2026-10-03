import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { EARLIER_MANIFEST_NAMES, MANIFEST_NAME } from "../registry/manifest.js";
import { MAX_BATCH_OUTPUT_BYTES } from "../review/git_batch.js";

import {
  MAX_MARKER_BYTES,
  parseCompletionMarker,
  type CacheLayout,
  type CompletionMarker,
} from "./cache_layout.js";
import { incompatibleEarlierBaseline } from "./compatibility.js";
import { confinedBaselineStat } from "./confinement.js";
import { validateBuiltInventory } from "./discovery.js";
import { BaselineError } from "./errors.js";
import { historicalCatalogueAt, manifestEnvelopeVersion } from "./manifest.js";
import type { BaselineBuildRequest, BaselineFileSystem } from "./types.js";

/** Validate identity before interpreting output; earlier caches never become readers. */
export async function completedBaseline(
  fs: BaselineFileSystem,
  layout: CacheLayout,
  request: BaselineBuildRequest,
): Promise<CompletionMarker | undefined> {
  if (
    !(await fs.stat(layout.marker)) ||
    !(await fs.stat(layout.output)) ||
    !(await fs.stat(path.join(layout.entry, "inputs.json")))
  )
    return;
  try {
    if ((await fs.stat(layout.marker))?.kind !== "regular")
      throw new Error("Completion marker is not regular");
    const marker = parseCompletionMarker(
      JSON.parse(
        Buffer.from(await fs.read(layout.marker, MAX_MARKER_BYTES)).toString(
          "utf8",
        ),
      ),
      request.commit,
    );
    if (!marker) throw new Error("Invalid baseline completion marker");
    if (
      (await fs.stat(layout.output))?.kind !== "directory" ||
      !(await fs.stat(path.join(layout.entry, "inputs.json")))
    )
      return;
    if (
      (await fs.stat(path.join(layout.entry, "inputs.json")))?.kind !==
      "regular"
    )
      throw new Error("Baseline inputs are not regular");
    const mockupsPath: unknown = JSON.parse(
      Buffer.from(
        await fs.read(path.join(layout.entry, "inputs.json"), MAX_MARKER_BYTES),
      ).toString("utf8"),
    );
    if (
      mockupsPath !== request.mockupsPath ||
      !isDeepStrictEqual(marker.commands, request.commands)
    )
      throw new BaselineError(
        "baseline-output-invalid",
        `Cached baseline uses different build settings; remove ${layout.entry} before changing catalogues or commands`,
      );
    if (marker.manifestVersion < 8) {
      if (!(await olderCacheExists(fs, layout, marker, request.signal))) return;
      return marker;
    }
    const selected = await historicalCatalogueAt(
      fs,
      layout.output,
      path.join(layout.output, marker.historicalCatalogueRoot!),
      request.commit,
      request.signal,
    );
    if (!selected) return;
    if ("incompatible" in selected)
      throw new Error(
        "Cached manifest version disagrees with completion marker",
      );
    await validateBuiltInventory(fs, layout.output, selected, request.signal);
    for (const file of selected.manifest.assetClosure) {
      const relative = path.posix.join(selected.descriptor.catalogueRoot, file);
      if (
        (
          await confinedBaselineStat(
            fs,
            layout.output,
            relative,
            request.signal,
          )
        )?.kind !== "regular"
      )
        throw new Error(`Missing cached authored resource: ${file}`);
    }
    return marker;
  } catch (error) {
    if (request.signal?.aborted || error instanceof BaselineError) throw error;
    throw new BaselineError(
      "baseline-output-invalid",
      "Invalid completed baseline cache",
      error,
    );
  }
}

async function olderCacheExists(
  fs: BaselineFileSystem,
  layout: CacheLayout,
  marker: CompletionMarker,
  signal?: AbortSignal,
): Promise<boolean> {
  const names =
    marker.layout === "generated-v6"
      ? [
          path.posix.join(
            marker.historicalCatalogueRoot!,
            GENERATED_DIRECTORY,
            MANIFEST_NAME,
          ),
        ]
      : [MANIFEST_NAME, ...EARLIER_MANIFEST_NAMES];
  for (const name of names) {
    const stat = await confinedBaselineStat(fs, layout.output, name, signal);
    if (!stat) continue;
    if (stat.kind !== "regular")
      throw new Error("Cached historical manifest is not regular");
    if (EARLIER_MANIFEST_NAMES.some((earlier) => earlier === name)) return true;
    const value: unknown = JSON.parse(
      Buffer.from(
        await fs.read(path.join(layout.output, name), MAX_BATCH_OUTPUT_BYTES),
      ).toString("utf8"),
    );
    if (manifestEnvelopeVersion(value) !== marker.manifestVersion)
      throw new Error(
        "Cached manifest version disagrees with completion marker",
      );
    return true;
  }
  return false;
}

/** Raise only after cache validation so callers retain the completed old entry. */
export function assertCurrentCache(marker: CompletionMarker): void {
  if (marker.manifestVersion < 8) throw incompatibleEarlierBaseline();
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
