import {
  EARLIER_BASELINE_MESSAGE,
  isIncompatibleEarlierBaseline,
} from "../../dist/baseline/compatibility.js";
import { acceptedGenerationFromCompilation } from "../../dist/review/accepted_generation.js";
import { prepareReviewRepository } from "../../dist/review/prepare.js";
import { loadCatalogueSnapshot } from "../../dist/server/catalogue_snapshot.js";
import { computeCatalogueChanges } from "../../dist/server/changed.js";

import { publicationChangeEvidence } from "./change_evidence.mjs";

/** Load one publication snapshot, retaining recognized earlier output as unavailable. */
export async function publicationSnapshot(
  config,
  git,
  base,
  manifest,
  compilation,
  exclusions,
) {
  try {
    const changeEvidence = git
      ? await publicationChangeEvidence(config, git, compilation, exclusions)
      : undefined;
    const snapshot = await loadCatalogueSnapshot(
      config,
      git
        ? (current, accepted) =>
            computeCatalogueChanges(
              config,
              base,
              git,
              current,
              changeEvidence,
              compilation
                ? acceptedGenerationFromCompilation(compilation)
                : accepted,
            )
        : undefined,
      manifest,
    );
    return { incompatible: false, changeEvidence, snapshot };
  } catch (error) {
    if (!isIncompatibleEarlierBaseline(error)) throw error;
    process.stderr.write(`${EARLIER_BASELINE_MESSAGE}\n`);
    return {
      incompatible: true,
      snapshot: await loadCatalogueSnapshot(config, undefined, manifest),
    };
  }
}

/** Reject older prepared output without turning requested Changes into a failed publication. */
export async function preparePublicationBaseline(config, base, includeChanges) {
  if (!includeChanges) return { prepared: undefined, incompatible: false };
  try {
    return {
      prepared: await prepareReviewRepository(config, base),
      incompatible: false,
    };
  } catch (error) {
    if (!isIncompatibleEarlierBaseline(error)) throw error;
    process.stderr.write(`${EARLIER_BASELINE_MESSAGE}\n`);
    return { prepared: undefined, incompatible: true };
  }
}
