import path from "node:path";

import { GitReviewAssetReader } from "../../dist/review/assets.js";
import {
  baselineResourceConfig,
  readBaseManifest,
} from "../../dist/review/base_manifest.js";
import { reviewChangedPaths } from "../../dist/review/changed_paths.js";
import { EvidenceAssetReader } from "../../dist/review/evidence_assets.js";
import { importedChangedPaths } from "../../dist/review/imported_changes.js";

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
