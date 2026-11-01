/**
 * Stage rendering from the validated public catalogue model. These
 * containers choose the frames; `@mokly/ui/stage` draws the stage and
 * `@mokly/ui/flow-step` a user flow's steps.
 */

import { useContext } from "react";

import { FlowStage, FlowStep } from "@mokly/ui/flow-step";
import { Stage } from "@mokly/ui/stage";

import { catalogueComponentVariants } from "../catalogue/entry_selection.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
} from "../catalogue/scoped_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { viewHref } from "../navigation/routes.js";
import { VIEWPORTS } from "../registry/views.js";

import { DisplaySelection } from "./display_context.js";
import { DocumentStageFrame } from "./document_stage_frame.js";
import { useNarrowLayout } from "./narrow_layout.js";
import { StageFrame } from "./stage_frame.js";

/** Render current frames without giving consumer documents script capability. */
export function PublicStage({
  catalogue,
  entry,
  fragment,
  hasDarkFragments,
  previewViews,
  variantPath,
}: {
  catalogue: ShellCatalogueReadModel;
  entry: ShellCatalogueRoutedEntry;
  fragment?: string;
  hasDarkFragments: boolean;
  previewViews?: readonly GeneratedComponentView[];
  variantPath?: string;
}) {
  const selection = useContext(DisplaySelection);
  if (entry.kind === "page" || entry.kind === "document")
    return (
      <DocumentStageFrame
        entry={entry}
        hasDarkFragments={hasDarkFragments}
        {...(fragment ? { fragment } : {})}
      />
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
  // A component parent shows its own views; the variant bar selects a variant.
  const selectedVariant =
    entry.kind === "component"
      ? ([
          entry,
          ...("variantOf" in entry
            ? []
            : catalogueComponentVariants(catalogue, entry.path)),
        ].find((candidate) => candidate.path === variantPath) ?? entry)
      : undefined;
  const views =
    entry.kind === "component"
      ? (selectedVariant?.views ?? [])
      : (entry as ShellCatalogueScreen).views;
  const effectiveVariant = selectedVariant?.path;
  const frameEntry = selectedVariant ?? entry;
  return (
    <Stage
      key={`${entry.path}:${effectiveVariant ?? ""}`}
      kind={entry.kind === "component" ? "component" : "live"}
      routed
      viewport={selection.viewport}
    >
      {VIEWPORTS.map((viewport) => (
        <StageFrame
          entry={frameEntry}
          hasDarkFragments={hasDarkFragments}
          key={`${entry.path}:${effectiveVariant ?? ""}:${viewport}`}
          views={views}
          viewport={viewport}
          {...(entry.kind === "component" && previewViews
            ? { previewViews }
            : {})}
          {...(effectiveVariant ? { variantPath: effectiveVariant } : {})}
          {...(fragment ? { fragment } : {})}
        />
      ))}
    </Stage>
  );
}

/**
 * Each step shows its screen's desktop view in a browser frame, or below
 * 760px its mobile view in a phone frame.
 */
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
  const viewport = useNarrowLayout() ? "mobile" : "desktop";
  return (
    <FlowStage>
      {entry.steps.map((step, index) => {
        const screen = catalogue.screens.find(
          (candidate) => candidate.path === step.screenPath,
        );
        return (
          <FlowStep
            description={step.description ?? screen?.details.description}
            key={`${step.screenPath}-${index}`}
            number={index + 1}
            screen={
              screen
                ? { href: viewHref(screen.path), title: screen.title }
                : undefined
            }
            title={step.title ?? screen?.title ?? step.screenPath}
          >
            {screen ? (
              <StageFrame
                entry={screen}
                flow
                hasDarkFragments={hasDarkFragments}
                key={`${screen.path}:${index}:${viewport}`}
                stepIndex={index}
                views={screen.views}
                viewport={viewport}
                {...(index === 0 && fragment ? { fragment } : {})}
              />
            ) : null}
          </FlowStep>
        );
      })}
    </FlowStage>
  );
}
