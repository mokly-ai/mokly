/** Compare a view batch and sample its isolate immediately after each result. */
import { timingDocumentWork } from "../diagnostics/timings.js";

import type { entryViewPairs } from "./component_pairing.js";
import {
  compareComponentView,
  type ComponentViewContext,
} from "./component_view.js";

export function compareComponentViews(
  context: ComponentViewContext,
  views: ReturnType<typeof entryViewPairs>["views"],
  root?: string,
) {
  const work = timingDocumentWork();
  return Promise.all(
    views.map((view) => {
      const compared = compareComponentView(
        context,
        view.before,
        view.after,
        root,
      );
      return work
        ? compared.then((result) => {
            work.comparedView(result.comparisonPath);
            return result;
          })
        : compared;
    }),
  );
}
