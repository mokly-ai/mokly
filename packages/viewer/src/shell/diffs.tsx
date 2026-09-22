/** On-demand React comparison controls inside the catalogue. */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import type { LoadedComparison } from "./comparison_request.js";
import { ComparisonViews } from "./comparison_views.js";
import { useComparison, type ComparisonMode } from "./use_comparison.js";

/** Keep the current screen mounted until a comparison is explicitly selected. */
export function DiffScreen({
  children,
  colorScheme,
  component = false,
  eligible = true,
  onComparisonChange,
  onModeChange,
  route,
  variantId,
}: {
  children: ReactNode;
  colorScheme?: "dark" | "light";
  component?: boolean;
  eligible?: boolean;
  onComparisonChange?(loaded: LoadedComparison | undefined): void;
  onModeChange?(mode: ComparisonMode): void;
  route: string;
  variantId?: string;
}) {
  const comparison = useComparison({
    ...(colorScheme ? { colorScheme } : {}),
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
  const current = comparison.mode === "current";
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
      />
      <div
        className="mbk-current-screen"
        data-current-screen=""
        hidden={!current}
      >
        {children}
      </div>
      <div
        aria-busy={comparison.busy ? true : undefined}
        aria-live="polite"
        className="mbk-diff-stage"
        data-diff-stage=""
        hidden={current}
      >
        {comparison.failure ? (
          <ComparisonFailure
            details={comparison.failure}
            retry={comparison.retry}
          />
        ) : comparison.loaded && comparison.presentation ? (
          <ComparisonViews
            component={component}
            loaded={comparison.loaded}
            presentation={comparison.presentation}
            route={route}
            {...(variantId ? { variantId } : {})}
          />
        ) : (
          "Loading comparison…"
        )}
      </div>
    </section>
  );
}

function ComparisonToolbar({
  current,
  eligible,
  loaded,
  mode,
  onMode,
  onRefresh,
}: {
  current: boolean;
  eligible: boolean;
  loaded: boolean;
  mode: ComparisonMode;
  onMode(mode: ComparisonMode): void;
  onRefresh(): void;
}) {
  const modes: readonly [ComparisonMode, string][] = [
    ["current", "Current"],
    ["side", "Side by side"],
    ["overlay", "Overlay"],
    ["difference", "Difference"],
  ];
  return (
    <div className="mbk-diff-toolbar" hidden={!eligible}>
      <span aria-label="Comparison mode" className="mbk-seg" role="group">
        {modes.map(([value, label]) => (
          <button
            aria-pressed={mode === value}
            data-diff-mode={value}
            key={value}
            onClick={() => onMode(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </span>
      <button
        aria-label="Refresh comparison"
        className="mbk-diff-refresh"
        data-diff-refresh=""
        hidden={current || !loaded}
        onClick={onRefresh}
        title="Refresh comparison"
        type="button"
      >
        <span aria-hidden="true">↻</span>
      </button>
    </div>
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
