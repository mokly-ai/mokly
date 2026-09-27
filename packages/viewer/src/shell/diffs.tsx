/** On-demand React comparison controls inside the catalogue. */

import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import type { LoadedComparison } from "./comparison_request.js";
import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "./comparison_selection.js";
import { ComparisonToolbar } from "./comparison_toolbar.js";
import { ComparisonViews } from "./comparison_views.js";
import { useComparison, type ComparisonMode } from "./use_comparison.js";
import { useComparisonDocuments } from "./use_comparison_documents.js";
import { useScrollTogether } from "./use_scroll_together.js";

/** Keep the current screen mounted until a comparison is explicitly selected. */
export function DiffScreen({
  children,
  component = false,
  effectiveColorScheme,
  eligible = true,
  onComparisonChange,
  onModeChange,
  route,
  variantId,
}: {
  children: ReactNode;
  component?: boolean;
  effectiveColorScheme?: "dark" | "light";
  eligible?: boolean;
  onComparisonChange?(loaded: LoadedComparison | undefined): void;
  onModeChange?(mode: ComparisonMode): void;
  route: string;
  variantId?: string;
}) {
  const comparison = useComparison({
    ...(effectiveColorScheme ? { effectiveColorScheme } : {}),
    eligible,
    route,
    ...(variantId ? { variantId } : {}),
  });
  const comparisonCallback = useRef(onComparisonChange);
  const modeCallback = useRef(onModeChange);
  comparisonCallback.current = onComparisonChange;
  modeCallback.current = onModeChange;
  useEffect(() => modeCallback.current?.(comparison.mode), [comparison.mode]);
  useEffect(
    () => comparisonCallback.current?.(comparison.loaded),
    [comparison.loaded],
  );
  const views = useMemo(
    () =>
      comparison.loaded && comparison.presentation
        ? selectedComparisonViews(
            comparison.loaded,
            comparison.presentation,
            route,
            variantId,
          )
        : undefined,
    [comparison.loaded, comparison.presentation, route, variantId],
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
      data-diff-component={component ? "" : undefined}
      data-diff-screen={route}
      data-diff-variant={variantId}
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
            component={component}
            presentation={comparison.presentation}
            presentations={documents.presentations}
            route={route}
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
