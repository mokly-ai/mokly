import type { HistoricalManifest } from "@mokly/viewer/data";

import { isIncompatibleEarlierBaseline } from "../baseline/compatibility.js";
import type { ResolvedConfig } from "../config/types.js";
import { readBaseManifest } from "../review/base_manifest.js";
import { prepareReviewRepository } from "../review/prepare.js";

import type { ExportOptions } from "./types.js";

/** Retain one prepared baseline or the expected earlier-version outcome. */
export async function prepareExportBaseline(
  config: ResolvedConfig,
  options: ExportOptions,
  base: string,
) {
  let prepared;
  try {
    prepared = options.noChanges
      ? undefined
      : await prepareReviewRepository(config, base, {
          ...(options.signal ? { signal: options.signal } : {}),
          ...(options.diagnostic ? { diagnostic: options.diagnostic } : {}),
        });
  } catch (error) {
    if (!isIncompatibleEarlierBaseline(error)) throw error;
    options.incompatibleBaseline?.(base);
    return {
      baseline: undefined,
      incompatible: true,
      prepared: undefined,
    };
  }
  let incompatible = false;
  let baseline: HistoricalManifest | undefined;
  if (prepared)
    try {
      baseline = await readBaseManifest(
        prepared.reader,
        prepared.commit,
        config,
      );
    } catch (error) {
      if (!isIncompatibleEarlierBaseline(error)) throw error;
      incompatible = true;
      options.incompatibleBaseline?.(prepared.commit);
    }
  return { baseline, incompatible, prepared };
}
