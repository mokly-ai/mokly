import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  MANIFEST_NAME,
  parseHistoricalManifest,
} from "../registry/manifest.js";
import { MAX_BATCH_OUTPUT_BYTES } from "../review/git_batch.js";

import {
  isCompletionTemporary,
  type CacheLayout,
  type CompletionMarker,
} from "./cache_layout.js";
import { readCacheMetadata } from "./cache_metadata.js";
import { baselineCatalogue, joinCataloguePath } from "./catalogue.js";
import { confinedBaselineStat } from "./confinement.js";
import { validateBuiltInventory } from "./discovery.js";
import { assertBaselineActive, BaselineError } from "./errors.js";
import type { BaselineBuildRequest, BaselineFileSystem } from "./types.js";

/** Validate metadata, compare settings, then validate current output for reuse. */
export async function completedBaseline(
  fs: BaselineFileSystem,
  layout: CacheLayout,
  request: BaselineBuildRequest,
): Promise<CompletionMarker | undefined> {
  const metadata = await readCacheMetadata(
    fs,
    layout,
    request.commit,
    request.signal,
  );
  if (!metadata) return;
  const { marker, mockupsPath } = metadata;
  if (
    mockupsPath !== request.mockupsPath ||
    !isDeepStrictEqual(marker.commands, request.commands)
  )
    throw new BaselineError(
      "baseline-output-invalid",
      `Cached baseline uses different build settings; remove ${layout.entry} before changing catalogues or commands`,
    );
  try {
    if ((await fs.stat(layout.output))?.kind !== "directory") return;
    const descriptor = baselineCatalogue(
      request.commit,
      marker.historicalCatalogueRoot,
    );
    const file = joinCataloguePath(descriptor.generatedRoot, MANIFEST_NAME);
    if (
      (await confinedBaselineStat(fs, layout.output, file, request.signal))
        ?.kind !== "regular"
    )
      return;
    const manifest = parseHistoricalManifest(
      JSON.parse(
        Buffer.from(
          await fs.read(path.join(layout.output, file), MAX_BATCH_OUTPUT_BYTES),
        ).toString("utf8"),
      ),
    );
    await validateBuiltInventory(
      fs,
      layout.output,
      { descriptor, manifest, version: 10 },
      request.signal,
    );
    for (const asset of manifest.assetClosure) {
      const relative = joinCataloguePath(descriptor.catalogueRoot, asset);
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
        return;
    }
    return marker;
  } catch {
    assertBaselineActive(request.signal);
    return;
  }
}

/** Remove partial content under the entry lock, preserving lock ownership. */
export async function removePartialBaseline(
  fs: BaselineFileSystem,
  layout: CacheLayout,
): Promise<void> {
  for (const file of [
    layout.marker,
    layout.source,
    layout.output,
    path.join(layout.entry, "inputs.json"),
    ...(await fs.list(layout.entry))
      .filter(isCompletionTemporary)
      .map((name) => path.join(layout.entry, name)),
  ])
    await fs.remove(file);
}
