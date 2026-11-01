/**
 * Current workspace preview or its explicit unavailable state, which
 * `@mokly/ui/empty-state` draws.
 */

import { RemovedState, RemovedVariantState } from "@mokly/ui/empty-state";

import { isManifestComponentVariant } from "../components/manifest_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { TargetStage } from "./stages.js";
import type { RouteTarget } from "./target.js";
import type { WorkspaceData } from "./workspace_data.js";

/** What a removed entry's stage calls it: a variant names itself. */
function removedSubject(
  entry: WorkspaceData["entry"],
): "component" | "screen" | "variant" {
  return entry.kind === "component" && isManifestComponentVariant(entry)
    ? "variant"
    : entry.kind;
}

/**
 * Render only an available current preview; comparisons stay independently
 * usable. A removed variant names itself, never its surviving parent, as the
 * component explorer contract requires.
 */
export function WorkspaceStage({
  catalogue,
  context,
  previewViews,
  data,
  target,
  variantPath,
  variantRemoved,
}: {
  catalogue: Catalogue;
  context: ShellContext;
  previewViews: readonly GeneratedComponentView[];
  data: WorkspaceData;
  target: RouteTarget;
  variantPath?: string;
  variantRemoved: boolean;
}) {
  if (data.removed) return <RemovedState kind={removedSubject(data.entry)} />;
  if (variantRemoved) return <RemovedVariantState />;
  return (
    <TargetStage
      catalogue={catalogue}
      previewViews={previewViews}
      target={target}
      {...(context.fragment ? { fragment: context.fragment } : {})}
      {...(variantPath ? { variantPath } : {})}
    />
  );
}
