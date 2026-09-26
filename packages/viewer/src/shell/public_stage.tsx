/** Hydrated stage rendering from the validated public catalogue model. */

import { useContext } from "react";

import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
} from "../catalogue/scoped_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { encodeUrlPath } from "../data/paths.js";
import { DisplaySelection } from "../viewer/display_context.js";

import { DocumentStageFrame, StageFrame } from "./stage_frame.js";

/** Render current frames without giving consumer documents script capability. */
export function PublicStage({
  catalogue,
  entry,
  fragment,
  hasDarkFragments,
  previewViews,
  variantId,
}: {
  catalogue: ShellCatalogueReadModel;
  entry: ShellCatalogueRoutedEntry;
  fragment?: string;
  hasDarkFragments: boolean;
  previewViews?: readonly GeneratedComponentView[];
  variantId?: string;
}) {
  const selection = useContext(DisplaySelection);
  if (entry.kind === "page")
    return (
      <DocumentStageFrame entry={entry} {...(fragment ? { fragment } : {})} />
    );
  if (entry.kind === "use-case")
    return (
      <UseCaseFlow
        catalogue={catalogue}
        entry={entry}
        hasDarkFragments={hasDarkFragments}
        {...(fragment ? { fragment } : {})}
      />
    );
  const selectedVariant =
    entry.kind === "component"
      ? (entry.variants.find(
          (variant) => variant.id === (variantId ?? selection.variantId),
        ) ?? entry.variants[0])
      : undefined;
  const views =
    entry.kind === "component"
      ? (selectedVariant?.views ?? [])
      : (entry as ShellCatalogueScreen).views;
  const effectiveVariant = selectedVariant?.id;
  return (
    <div
      className={`mbk-stage ${entry.kind === "component" ? "mbk-component-stage" : "mbk-live"}`}
      data-mokly-scroll="stage"
      data-mokly-stage=""
      data-viewport={selection.viewport}
      key={`${entry.route}:${effectiveVariant ?? ""}`}
    >
      {entry.viewports.map((viewport) => (
        <StageFrame
          entry={entry}
          hasDarkFragments={hasDarkFragments}
          key={`${entry.route}:${effectiveVariant ?? ""}:${viewport}`}
          views={views}
          viewport={viewport}
          {...(entry.kind === "component" && previewViews
            ? { previewViews }
            : {})}
          {...(effectiveVariant ? { variantId: effectiveVariant } : {})}
          {...(fragment ? { fragment } : {})}
        />
      ))}
    </div>
  );
}

function UseCaseFlow({
  catalogue,
  entry,
  fragment,
  hasDarkFragments,
}: {
  catalogue: ShellCatalogueReadModel;
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "use-case" }>;
  fragment?: string;
  hasDarkFragments: boolean;
}) {
  return (
    <div className="mbk-flow" data-mokly-scroll="flow">
      <div className="flow-track">
        {entry.steps.map((step, index) => {
          const screen = catalogue.screens.find(
            (candidate) => candidate.id === step.screenId,
          );
          return (
            <section className="flow-step" key={`${step.screenId}-${index}`}>
              <div className="flow-step-head">
                <span className="flow-step-num">{index + 1}</span>
                <div>
                  <h3>{step.title ?? screen?.title ?? step.screenId}</h3>
                  <p>{step.description ?? screen?.details.description}</p>
                  {screen ? (
                    <a
                      className="flow-step-link"
                      href={`/view/${encodeUrlPath(screen.route)}`}
                    >
                      This screen in the catalogue: {screen.title} →
                    </a>
                  ) : null}
                </div>
              </div>
              {screen ? (
                <StageFrame
                  entry={screen}
                  flow
                  hasDarkFragments={hasDarkFragments}
                  key={`${screen.route}:${index}`}
                  stepIndex={index}
                  views={screen.views}
                  viewport="desktop"
                  {...(index === 0 && fragment ? { fragment } : {})}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
