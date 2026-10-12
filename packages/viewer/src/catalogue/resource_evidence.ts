import { exactKeys, invalidData } from "../components/data.js";
import {
  validateResourceEvidence,
  validateInlineStyleEvidence,
} from "../review/result_resources.js";
import type { ResourceEvidence, InlineStyleEvidence } from "../review/types.js";

/** Strict rule evidence is shared by catalogue and comparison readers. */
export function readResourceEvidence(
  value: unknown,
  inline = false,
): ResourceEvidence & { inlineStyles?: InlineStyleEvidence } {
  exactKeys(
    value,
    ["reasons", "excludedResources", ...(inline ? ["inlineStyles"] : [])],
    "$catalogue.resourceEvidence",
  );
  if (!Object.keys(value).length)
    invalidData("$catalogue", "empty resource evidence");
  const { inlineStyles, ...resources } = value;
  validateResourceEvidence(resources, undefined);
  if (inlineStyles !== undefined) validateInlineStyleEvidence(inlineStyles);
  return structuredClone(value) as ResourceEvidence;
}
