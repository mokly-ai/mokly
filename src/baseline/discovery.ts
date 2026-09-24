import path from "node:path";

import { gitBlobHash } from "../registry/blob_hash.js";
import { MANIFEST_NAME } from "../registry/manifest.js";
import { MAX_BATCH_OUTPUT_BYTES } from "../review/git_batch.js";

import { joinCataloguePath } from "./catalogue.js";
import { confinedBaselineStat, validateOutputTree } from "./confinement.js";
import { BaselineError, assertBaselineActive } from "./errors.js";
import { historicalCatalogueAt, type HistoricalCatalogue } from "./manifest.js";
import type { BaselineBuildRequest, BaselineFileSystem } from "./types.js";

/** Prefer the requested root, then search a bounded extraction without following links. */
export async function discoverHistoricalCatalogue(
  fs: BaselineFileSystem,
  extraction: string,
  request: BaselineBuildRequest,
): Promise<HistoricalCatalogue> {
  const requested = path.join(extraction, request.mockupsPath);
  const preferred = await historicalCatalogueAt(
    fs,
    extraction,
    requested,
    request.commit,
    request.allowManifestV2 ?? false,
    request.signal,
  );
  if (preferred) return preferred;
  const candidates: HistoricalCatalogue[] = [];
  const pending = [extraction];
  let visited = 0;
  while (pending.length) {
    assertBaselineActive(request.signal);
    if (++visited > 65_536)
      throw new BaselineError(
        "baseline-output-invalid",
        "Historical catalogue search exceeds extraction bounds",
      );
    const directory = pending.pop()!;
    if (
      directory !== requested &&
      !(
        path.basename(directory) === ".generated" &&
        (await fs.stat(path.join(directory, MANIFEST_NAME)))?.kind === "regular"
      )
    ) {
      try {
        const candidate = await historicalCatalogueAt(
          fs,
          extraction,
          directory,
          request.commit,
          request.allowManifestV2 ?? false,
          request.signal,
        );
        if (candidate) candidates.push(candidate);
      } catch {
        assertBaselineActive(request.signal);
      }
    }
    const names = await fs.list(directory);
    for (const name of [...names].sort().reverse()) {
      if ([".git", ".mokly-cache", "node_modules"].includes(name)) continue;
      if ((await fs.stat(path.join(directory, name)))?.kind === "directory")
        pending.push(path.join(directory, name));
    }
  }
  if (candidates.length !== 1) {
    const names = candidates
      .map(
        ({ descriptor }) =>
          `${descriptor.catalogueRoot} (${descriptor.layout})`,
      )
      .sort();
    throw new BaselineError(
      "baseline-output-invalid",
      `No unique historical catalogue after baseline build; candidates: ${names.join(", ") || "(none)"}.`,
    );
  }
  return candidates[0]!;
}

/** Ensure historical compilation really populated its v6 inventory before harvesting. */
export async function validateBuiltInventory(
  fs: BaselineFileSystem,
  extraction: string,
  selected: HistoricalCatalogue,
  signal?: AbortSignal,
): Promise<void> {
  const manifest = selected.manifest;
  if (manifest.schemaVersion !== 6 || !("generatedFiles" in manifest)) return;
  const generated = path.join(extraction, selected.descriptor.generatedRoot);
  await validateOutputTree(fs, generated, signal);
  const actual: string[] = [];
  const pending = [generated];
  while (pending.length) {
    const current = pending.pop()!;
    for (const name of await fs.list(current)) {
      const candidate = path.join(current, name);
      if ((await fs.stat(candidate))?.kind === "directory")
        pending.push(candidate);
      else
        actual.push(
          path.relative(generated, candidate).split(path.sep).join("/"),
        );
    }
  }
  const expected = new Set(manifest.generatedFiles.map(({ path }) => path));
  const files = actual.filter((file) => file !== MANIFEST_NAME);
  if (
    files.some((file) => !expected.has(file)) ||
    files.length !== expected.size
  )
    throw new BaselineError(
      "baseline-output-invalid",
      "Rebuilt generated output does not match its manifest inventory",
    );
  for (const item of manifest.generatedFiles) {
    const filename = joinCataloguePath(
      selected.descriptor.generatedRoot,
      item.path,
    );
    const stat = await confinedBaselineStat(fs, extraction, filename, signal);
    if (stat?.kind !== "regular")
      throw new BaselineError(
        "baseline-output-invalid",
        `Missing rebuilt generated file: ${item.path}`,
      );
    const bytes = await fs.read(
      path.join(extraction, filename),
      MAX_BATCH_OUTPUT_BYTES,
    );
    if (gitBlobHash(bytes, manifest.blobHashAlgorithm) !== item.blobHash)
      throw new BaselineError(
        "baseline-output-invalid",
        `Stale rebuilt generated file: ${item.path}`,
      );
  }
}
