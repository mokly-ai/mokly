import type { ReviewResultV3 } from "@mokly/viewer/data";

import type { ComponentClassificationInput } from "./component_classification_input.js";
import { classifyComponentsWithSources } from "./component_classification_sources.js";
import { validateComponentReviewSources } from "./component_result_sources.js";

/** The sole component-aware membership policy, shared by Browse, Review, and publishing. */
export async function classifyComponents(
  input: ComponentClassificationInput,
): Promise<ReviewResultV3> {
  const classified = await classifyComponentsWithSources(input);
  validateComponentReviewSources(
    classified.result,
    input.before,
    input.after,
    classified.implementationImpact,
    classified.sources,
  );
  return classified.result;
}
