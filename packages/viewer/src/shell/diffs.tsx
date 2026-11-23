/**
 * On-demand React comparison controls inside the catalogue. This container
 * reads the comparison controller and its documents;
 * `@mokly/ui/comparison-stage` draws the comparison on the canvas, and
 * `@mokly/ui/comparison-toolbar` its band in the right panel.
 */

import { useMemo, useRef } from "react";
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
import { focusThen } from "./retry_focus.js";
import type { ComparisonController } from "./use_comparison.js";
import { useComparisonDocuments } from "./use_comparison_documents.js";
import { useScrollTogether } from "./use_scroll_together.js";

/**
 * The comparison band of a controller owned by the workspace: the compare
 * modes, Scroll together and Refresh, which the right panel holds.
 */
export function ComparisonBand({
  comparison,
  eligible = true,
}: {
  comparison: ComparisonController;
  eligible?: boolean;
}) {
  const together = useScrollTogether();
  return (
    <ComparisonToolbar
      current={comparison.mode === "current"}
      eligible={eligible}
      loaded={comparison.loaded !== undefined}
      mode={comparison.mode}
      onMode={comparison.selectMode}
      onRefresh={comparison.refresh}
      onTogether={together.set}
      together={together.on}
    />
  );
}

/**
 * Render the comparison stage around a controller owned by the workspace:
 * Current shows the canvas, and a compare mode its stage in the canvas's
 * place.
 */
export function ControlledDiffScreen({
  children,
  compared,
  comparison,
  entryId,
  entryKind,
  usingChanged,
}: {
  children: ReactNode;
  /** The routed entry's comparison facts from its detail. */
  compared?: ComparedEntry | undefined;
  comparison: ComparisonController;
  entryId: string;
  entryKind: ViewRouteKind;
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
  const rows = useComparisonDocuments(
    comparison.presentation ? comparison.generations : undefined,
    [{ addresses: selectedComparisonDocuments(views), entry: entryId }],
  );
  const documents = rows.get(entryId) ?? { status: "idle" };
  const together = useScrollTogether();
  // The stage shows that the comparison loads and then its sections, so
  // Try again focuses the stage.
  const stage = useRef<HTMLDivElement>(null);
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
          <ComparisonFailure
            details={failure}
            onRetry={focusThen(stage, comparison.retry)}
          />
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
      stageRef={stage}
    >
      {children}
    </ComparisonStage>
  );
}
