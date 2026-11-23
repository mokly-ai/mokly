/**
 * Stage rendering from the validated public catalogue model. These
 * containers choose the frames; `@mokly/ui/stage` draws the stage. A use
 * case stands on the canvas instead, in `canvas_use_case.tsx`.
 */

import { useContext } from "react";

import { Stage } from "@mokly/ui/stage";

import { catalogueComponentVariants } from "../catalogue/entry_selection.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
} from "../catalogue/scoped_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { VIEWPORTS } from "../registry/views.js";

import { DisplaySelection } from "./display_context.js";
import { DocumentStageFrame } from "./document_stage_frame.js";
import { useShellRoot } from "./root_context.js";
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
  entry: Exclude<ShellCatalogueRoutedEntry, { kind: "use-case" }>;
  fragment?: string;
  hasDarkFragments: boolean;
  previewViews?: readonly GeneratedComponentView[];
  variantPath?: string;
}) {
  const elements = useShellRoot()?.elements;
  const selection = useContext(DisplaySelection);
  if (entry.kind === "page" || entry.kind === "document")
    return (
      <DocumentStageFrame
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
    entry.kind === "component" ? (selectedVariant?.views ?? []) : entry.views;
  const effectiveVariant = selectedVariant?.path;
  const frameEntry = selectedVariant ?? entry;
  return (
    <Stage
      key={`${entry.path}:${effectiveVariant ?? ""}`}
      kind={entry.kind === "component" ? "component" : "live"}
      routed
      ref={elements?.scrolls.ref("stage")}
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
