import { exactKeys, invalidData } from "../components/data.js";
import { validateResourceEvidence } from "../review/result_resources.js";
import type { ResourceEvidence } from "../review/types.js";

/** Strict rule evidence is shared by catalogue and comparison readers. */
export function readResourceEvidence(value: unknown): ResourceEvidence {
  exactKeys(
    value,
    ["reasons", "excludedResources"],
    "$catalogue.resourceEvidence",
  );
  if (!Object.keys(value).length)
    invalidData("$catalogue", "empty resource evidence");
  validateResourceEvidence(value, undefined);
  return structuredClone(value) as ResourceEvidence;
}
