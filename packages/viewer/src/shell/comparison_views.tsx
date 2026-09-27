/** React rendering for isolated before/current comparison panes. */

import type { ViewReview } from "../review/types.js";

import type { LoadedComparison } from "./comparison_request.js";
import { entryWording } from "./entry_wording.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";
import type { ComparisonPresentation } from "./use_comparison.js";
import { isStyleOnlyView } from "./workspace_style_evidence.js";

const stateLabels = {
  added: "New screen",
  changed: "Screen changed",
  "ignored-only": "Only excluded content changed",
  removed: "Screen removed",
  unchanged: "No changes to this screen",
} as const;

/** Render panes for the active route, saved variant, and adopted presentation. */
export function ComparisonViews({
  component,
  loaded,
  presentation,
  route,
  variantId,
}: {
  component: boolean;
  loaded: LoadedComparison;
  presentation: ComparisonPresentation;
  route: string;
  variantId?: string;
}) {
  const entry = comparisonEntry(loaded, route, variantId);
  if (!entry) return <p>This screen has no comparison available.</p>;
  const wording = entryWording(component ? "component" : "screen");
  return (
    <>
      {(["mobile", "desktop"] as const).map((viewport) => {
        if (
          presentation.viewport !== "both" &&
          presentation.viewport !== viewport
        )
          return null;
        const view =
          entry.views.find(
            (candidate) =>
              candidate.viewport === viewport &&
              candidate.colorScheme === presentation.colorScheme,
          ) ??
          entry.views.find(
            (candidate) =>
              candidate.viewport === viewport &&
              candidate.colorScheme === "light",
          );
        if (!view) return null;
        const mode =
          view.beforePath && view.afterPath ? presentation.mode : "side";
        const label = isStyleOnlyView(view)
          ? "Styles this screen uses changed"
          : stateLabels[view.state];
        return (
          <section
            className={`mbk-diff-view mbk-diff-${viewport}`}
            data-diff-viewport={viewport}
            key={viewport}
          >
            <h3>
              {viewport === "mobile" ? "Mobile" : "Desktop"} ·{" "}
              {wording.label(label)}
              {presentation.requestedColorScheme !== view.colorScheme
                ? " · Light only"
                : ""}
            </h3>
            <div className="mb-panes" data-compare-mode={mode}>
              <ComparisonPane
                component={component}
                loaded={loaded}
                route={route}
                side="before"
                view={view}
              />
              <ComparisonPane
                component={component}
                loaded={loaded}
                route={route}
                side="after"
                view={view}
              />
            </div>
          </section>
        );
      })}
    </>
  );
}

function ComparisonPane({
  component,
  loaded,
  route,
  side,
  view,
}: {
  component: boolean;
  loaded: LoadedComparison;
  route: string;
  side: "after" | "before";
  view: ViewReview;
}) {
  const label = side === "before" ? "Before" : "Current";
  const source = side === "before" ? view.beforePath : view.afterPath;
  return (
    <div className={`mb-pane mb-pane--${side}`}>
      <p className="mb-pane-label">{label}</p>
      {source ? (
        <div
          className="mb-pane-doc mbk-frame-wrap"
          data-color-scheme-fallback={
            view.colorScheme === "light" ? "" : undefined
          }
          data-preview-color-scheme={view.colorScheme}
        >
          <ComparisonFrame
            component={component}
            label={label}
            route={route}
            source={snapshotUrl(loaded.url, source)}
            view={view}
          />
        </div>
      ) : (
        <p className="mb-pane-missing">
          {side === "before"
            ? "This screen was added on this branch."
            : "This screen was removed on this branch."}
        </p>
      )}
    </div>
  );
}

function ComparisonFrame({
  component,
  label,
  route,
  source,
  view,
}: {
  component: boolean;
  label: string;
  route: string;
  source: string;
  view: ViewReview;
}) {
  const frame = (
    <iframe
      className="mbk-frag"
      sandbox=""
      src={source}
      title={`${label} — ${view.viewport} — ${view.colorScheme}`}
    />
  );
  if (component) return frame;
  return view.viewport === "mobile" ? (
    <PhoneFrame>{frame}</PhoneFrame>
  ) : (
    <BrowserFrame address={route} expandable={false}>
      {frame}
    </BrowserFrame>
  );
}

function comparisonEntry(
  loaded: LoadedComparison,
  route: string,
  variantId: string | undefined,
): { views: readonly ViewReview[] } | undefined {
  const component =
    loaded.result.schemaVersion === 3
      ? loaded.result.components.find((candidate) => candidate.route === route)
      : undefined;
  const variant = component?.variants.find(
    (candidate) => candidate.id === variantId,
  );
  if (component) return variant;
  return loaded.result.screens.find((candidate) => candidate.route === route);
}

function snapshotUrl(base: string, source: string): string {
  return new URL(source.split("/").map(encodeURIComponent).join("/"), base)
    .href;
}
