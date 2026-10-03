import { generatedViews } from "@mokly/viewer/data";

import { cachedReviewAssets } from "../cached_assets.js";
import type { ComponentClassificationInput } from "../component_classification_input.js";

import { readMovePairing } from "./read.js";
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
  const pairing = await readMovePairing(
    input.before.entries,
    input.after.entries,
    beforeReader,
    afterReader,
  );
  return { ...input, beforeReader, afterReader, pairing };
}
