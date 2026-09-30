/** Compare a view batch and sample its isolate immediately after each result. */
import { timingDocumentWork } from "../diagnostics/timings.js";

import type { viewPairs } from "./component_pairing.js";
import {
  compareComponentView,
  type ComponentViewContext,
} from "./component_view.js";

export function compareComponentViews(
  context: ComponentViewContext,
  views: ReturnType<typeof viewPairs>,
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
