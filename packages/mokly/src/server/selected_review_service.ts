/** Compose the shared selected-generation routes from configured providers. */
import type {
  RemovedPagePreviewProvider,
  RemovedPagePreviewSource,
  SelectedReviewProvider,
  SelectedReviewSource,
} from "../review/selection_types.js";

import { SelectedReviewRoutes } from "./selected_review_routes.js";

interface SelectedReviewServices {
  readonly base: string;
  readonly selected?: SelectedReviewProvider;
  readonly pagePreview?: RemovedPagePreviewProvider;
}

/** Keep comparison and page capture behind one bounded generation service. */
export function createSelectedReviewRoutes(
  services: SelectedReviewServices,
  comparisonSource: () => SelectedReviewSource | undefined,
  pageSource: () => RemovedPagePreviewSource | undefined,
): SelectedReviewRoutes | undefined {
  if (!services.selected && !services.pagePreview) return;
  return new SelectedReviewRoutes({
    base: services.base,
    ...(services.selected
      ? {
          comparison: {
            provider: services.selected,
            source: comparisonSource,
          },
        }
      : {}),
    ...(services.pagePreview
      ? { page: { provider: services.pagePreview, source: pageSource } }
      : {}),
  });
}
