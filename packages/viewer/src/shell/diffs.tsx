/**
 * On-demand React comparison controls inside the catalogue. This container
 * reads the comparison controller and its documents;
 * `@mokly/ui/comparison-stage` draws the comparison and
 * `@mokly/ui/comparison-toolbar` its band.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";

import { ComparisonFailure, ComparisonStage } from "@mokly/ui/comparison-stage";
import { ComparisonToolbar } from "@mokly/ui/comparison-toolbar";

import type { ViewRouteKind } from "../navigation/routes.js";
import type { ComparedEntry } from "../review/types.js";

import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "./comparison_selection.js";
import { ComparisonViews } from "./comparison_views.js";
import type { ComparisonController } from "./use_comparison.js";
import { useComparisonDocuments } from "./use_comparison_documents.js";
import { useScrollTogether } from "./use_scroll_together.js";

/** Render comparison chrome around a controller owned by the workspace. */
export function ControlledDiffScreen({
  children,
  compared,
  comparison,
  entryId,
  entryKind,
  eligible = true,
  usingChanged,
}: {
  children: ReactNode;
  /** The routed entry's comparison facts from its detail. */
  compared?: ComparedEntry | undefined;
  comparison: ComparisonController;
  entryId: string;
  entryKind: ViewRouteKind;
  eligible?: boolean;
  /** The axes keys of the routed views that use a changed component. */
  usingChanged?: ReadonlySet<string>;
}) {
  const views = useMemo(
    () =>
      comparison.loaded && comparison.presentation
        ? selectedComparisonViews(
            comparison.loaded,
            comparison.presentation,
            compared,
            usingChanged,
          )
        : undefined,
    [compared, comparison.loaded, comparison.presentation, usingChanged],
  );
  const documents = useComparisonDocuments(
    comparison.presentation ? comparison.loaded : undefined,
    selectedComparisonDocuments(views),
  );
  const together = useScrollTogether();
  const current = comparison.mode === "current";
  const failure =
    comparison.failure ??
    (documents.status === "failed" ? documents.message : undefined);
  return (
    <ComparisonStage
      busy={comparison.busy || documents.status === "loading"}
      component={entryKind === "component"}
      current={current}
      entryId={entryId}
      stage={
        failure ? (
          <ComparisonFailure details={failure} onRetry={comparison.retry} />
        ) : comparison.presentation && documents.status === "ready" ? (
          <ComparisonViews
            entryId={entryId}
            entryKind={entryKind}
            presentation={comparison.presentation}
            presentations={documents.presentations}
            together={together.on}
            views={views}
          />
        ) : undefined
      }
      toolbar={
        <ComparisonToolbar
          current={current}
          eligible={eligible}
          loaded={comparison.loaded !== undefined}
          mode={comparison.mode}
          onMode={comparison.selectMode}
          onRefresh={comparison.refresh}
          onTogether={together.set}
          together={together.on}
        />
      }
    >
      {children}
    </ComparisonStage>
  );
}
