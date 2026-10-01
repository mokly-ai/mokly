import {
  EARLIER_BASELINE_MESSAGE,
  isIncompatibleEarlierBaseline,
} from "../../dist/baseline/compatibility.js";
import { loadCatalogueSnapshot } from "../../dist/server/catalogue_snapshot.js";
import { computeCatalogueChanges } from "../../dist/server/changed.js";

/** Load one publication snapshot, retaining recognized earlier output as unavailable. */
export async function publicationSnapshot(config, git, base, manifest) {
  try {
    return {
      incompatible: false,
      snapshot: await loadCatalogueSnapshot(
        config,
        git
          ? (current) => computeCatalogueChanges(config, base, git, current)
          : undefined,
        manifest,
      ),
    };
  } catch (error) {
    if (!isIncompatibleEarlierBaseline(error)) throw error;
    process.stderr.write(`${EARLIER_BASELINE_MESSAGE}\n`);
    return {
      incompatible: true,
      snapshot: await loadCatalogueSnapshot(config, undefined, manifest),
    };
  }
}
