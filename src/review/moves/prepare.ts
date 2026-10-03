import path from "node:path";

import { generatedViews } from "@mokly/viewer/data";

import { toPosixPath } from "../../config/paths.js";
import { cachedReviewAssets } from "../cached_assets.js";
import type { ComponentClassificationInput } from "../component_classification_input.js";

import { readMovePairing } from "./read.js";
import { readMoveResources } from "./resources.js";
import { unchangedMovedSources } from "./source_moves.js";
import type { MovePairing } from "./types.js";

/** Bind one accepted pairing and retained readers before any entry is classified. */
export async function prepareMoveClassification(
  input: ComponentClassificationInput,
): Promise<ComponentClassificationInput & { pairing: MovePairing }> {
  if (input.pairing) return { ...input, pairing: input.pairing };
  const beforeReader = cachedReviewAssets(input.beforeReader);
  const afterReader = cachedReviewAssets(input.afterReader);
  await Promise.all([
    beforeReader.readMany!(
      input.before.entries.flatMap((entry) =>
        generatedViews(entry).map((view) => view.path),
      ),
    ),
    afterReader.readMany!(
      input.after.entries.flatMap((entry) =>
        generatedViews(entry).map((view) => view.path),
      ),
    ),
  ]);
  const resourceEvidence = await readMoveResources(
    input.before.entries,
    input.after.entries,
    beforeReader,
    afterReader,
  );
  const pairing = await readMovePairing(
    input.before.entries,
    input.after.entries,
    beforeReader,
    afterReader,
    input.markdown,
    resourceEvidence,
  );
  const resources = resourceEvidence.paired(
    input.before.entries,
    input.after.entries,
    pairing.moves,
  );
  const prefix = toPosixPath(
    path.relative(input.config.repoRoot, input.config.mockupsDir),
  );
  const unchanged = new Set([
    ...resources.unchangedPaths(prefix),
    ...(await unchangedMovedSources(
      input.before,
      input.after,
      pairing.moves,
      input.config,
      input.sourceReader,
      input.baseCommit,
    )),
  ]);
  return {
    ...input,
    beforeReader,
    afterReader,
    pairing,
    resources,
    changedPaths: input.changedPaths.filter(
      (changed) => !unchanged.has(changed),
    ),
  };
}
