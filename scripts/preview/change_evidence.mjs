import path from "node:path";

import { GitReviewAssetReader } from "../../packages/mokly/dist/review/assets.js";
import {
  baselineResourceConfig,
  readBaseManifest,
} from "../../packages/mokly/dist/review/base_manifest.js";
import { reviewChangedPaths } from "../../packages/mokly/dist/review/changed_paths.js";
import { EvidenceAssetReader } from "../../packages/mokly/dist/review/evidence_assets.js";
import { importedChangedPaths } from "../../packages/mokly/dist/review/imported_changes.js";

/** Share one pinned authored/generated evidence set across published Changes and Review. */
export async function publicationChangeEvidence(
  config,
  prepared,
  compilation,
  exclusions,
) {
  const baseline = await readBaseManifest(
    prepared.reader,
    prepared.commit,
    config,
  );
  const prefix = path
    .relative(config.repoRoot, config.mockupsDir)
    .split(path.sep)
    .join("/");
  const before = new GitReviewAssetReader(
    baselineResourceConfig(config, baseline),
    prepared.reader,
    prepared.commit,
    prefix,
  );
  const authored = await reviewChangedPaths(
    prepared.evidence,
    prepared.commit,
    config,
    config.review.outDir,
    exclusions,
  );
  const head = new EvidenceAssetReader(config, compilation?.outputs);
  return importedChangedPaths(
    config,
    before,
    head,
    authored,
    compilation?.outputs,
    compilation?.deliveredStyleSources,
  );
}
