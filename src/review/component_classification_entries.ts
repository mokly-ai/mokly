import { timeAsync } from "../diagnostics/timings.js";

import type { ComponentClassificationInput } from "./component_classification_input.js";
import type { ComponentViewContext } from "./component_view_types.js";
import { reviewViews } from "./views.js";

/** Prefetch all current and baseline views before pair classification starts. */
export async function prefetchClassificationViews(
  context: ComponentViewContext,
  before: ComponentClassificationInput["before"],
  after: ComponentClassificationInput["after"],
  timeBaselineRead: boolean,
): Promise<void> {
  const prefetchBefore = () =>
    context.beforeReader.prefetch(
      before.entries.flatMap((entry) =>
        reviewViews(entry).map((view) => view.path),
      ),
    );
  await Promise.all([
    timeBaselineRead
      ? timeAsync("review.base-documents", prefetchBefore)
      : prefetchBefore(),
    context.afterReader.prefetch(
      after.entries.flatMap((entry) =>
        reviewViews(entry).map((view) => view.path),
      ),
    ),
  ]);
}
