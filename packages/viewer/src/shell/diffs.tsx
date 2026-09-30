/** On-demand React comparison controls inside the catalogue. */

import { useMemo } from "react";
import type { ReactNode } from "react";

import type { ViewRouteKind } from "../navigation/routes.js";

import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "./comparison_selection.js";
import { ComparisonToolbar } from "./comparison_toolbar.js";
import { ComparisonViews } from "./comparison_views.js";
import type { ComparisonController } from "./use_comparison.js";
import { useComparisonDocuments } from "./use_comparison_documents.js";
import { useScrollTogether } from "./use_scroll_together.js";

/** Render comparison chrome around a controller owned by the workspace. */
export function ControlledDiffScreen({
  children,
  comparison,
  entryId,
  entryKind,
  eligible = true,
}: {
  children: ReactNode;
  comparison: ComparisonController;
  entryId: string;
  entryKind: ViewRouteKind;
  eligible?: boolean;
}) {
  const views = useMemo(
    () =>
      comparison.loaded && comparison.presentation
        ? selectedComparisonViews(
            comparison.loaded,
            comparison.presentation,
            entryKind,
            entryId,
          )
        : undefined,
    [comparison.loaded, comparison.presentation, entryId, entryKind],
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
    <section
      className="mbk-diff-screen"
      data-diff-component={entryKind === "component" ? "" : undefined}
      data-diff-screen={entryId}
    >
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
      <div
        className="mbk-current-screen"
        data-current-screen=""
        hidden={!current}
      >
        {children}
      </div>
      <div
        aria-busy={
          comparison.busy || documents.status === "loading" ? true : undefined
        }
        aria-live="polite"
        className="mbk-diff-stage"
        data-diff-stage=""
        hidden={current}
      >
        {failure ? (
          <ComparisonFailure details={failure} retry={comparison.retry} />
        ) : comparison.presentation && documents.status === "ready" ? (
          <ComparisonViews
            entryId={entryId}
            entryKind={entryKind}
            presentation={comparison.presentation}
            presentations={documents.presentations}
            together={together.on}
            views={views}
          />
        ) : (
          "Loading comparison…"
        )}
      </div>
    </section>
  );
}

function ComparisonFailure({
  details,
  retry,
}: {
  details: string;
  retry(): void;
}) {
  return (
    <>
      <p>
        The comparison could not be loaded.{" "}
        <button data-diff-refresh="" onClick={retry} type="button">
          Try again
        </button>
      </p>
      <details data-comparison-failure="">
        <summary>Comparison details</summary>
        <p>{details}</p>
      </details>
    </>
  );
}
