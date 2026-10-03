import path from "node:path";

import {
  GENERATED_DIRECTORY,
  type HistoricalManifest,
} from "@mokly/viewer/data";

import { joinCataloguePath } from "../baseline/catalogue.js";
import { incompatibleEarlierBaseline } from "../baseline/compatibility.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  EARLIER_MANIFEST_NAMES,
  MANIFEST_NAME,
  parseHistoricalManifest,
} from "../registry/manifest.js";

import type { BaselineReader } from "./git.js";

/** Read v8, with bounded envelope-only recognition at the known earlier locations. */
export async function readBaseManifest(
  git: BaselineReader,
  commit: string,
  config: ResolvedConfig,
): Promise<HistoricalManifest> {
  return timeAsync("review.base-manifest", async () => {
    const root =
      git.catalogue?.catalogueRoot ??
      (toPosixPath(path.relative(config.repoRoot, config.mockupsDir)) || ".");
    for (const name of [
      `${GENERATED_DIRECTORY}/${MANIFEST_NAME}`,
      MANIFEST_NAME,
      ...EARLIER_MANIFEST_NAMES,
    ]) {
      const candidate = joinCataloguePath(root, name);
      const kind = await git.fileKind(commit, candidate);
      if (kind === "missing") continue;
      if (kind !== "regular")
        throw new MoklyError(
          "manifest-invalid",
          `Historical manifest is not a regular file: ${candidate}`,
        );
      if (EARLIER_MANIFEST_NAMES.some((earlier) => earlier === name))
        throw incompatibleEarlierBaseline();
      const manifest = parseHistoricalManifest(
        JSON.parse(await git.readFile(commit, candidate)),
      );
      if (name === MANIFEST_NAME)
        throw new MoklyError(
          "manifest-invalid",
          "Historical v8 manifest must be in the generated directory",
        );
      return manifest;
    }
    throw new MoklyError("manifest-invalid", "Historical manifest is missing");
  });
}

/** Apply the baseline's source policy without executing historical consumer code. */
export function baselineResourceConfig(
  config: ResolvedConfig,
  manifest: HistoricalManifest,
): ResolvedConfig {
  return { ...config, sourceFiles: manifest.sourceFiles };
}
