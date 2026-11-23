/**
 * Current workspace preview or its explicit unavailable state, which
 * `@mokly/ui/empty-state` draws.
 */

import { RemovedState, RemovedVariantState } from "@mokly/ui/empty-state";

import { isComponentVariant } from "../catalogue/variants.js";

import type { WorkspaceCanvas } from "./canvas_workspace.js";
import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { TargetStage } from "./stages.js";
import type { RouteTarget } from "./target.js";
import type { WorkspaceData } from "./workspace_data.js";

/** What a removed entry's stage calls it: a variant names itself. */
function removedSubject(
  entry: WorkspaceData["entry"],
): "component" | "screen" | "variant" {
  return entry.kind === "component" && isComponentVariant(entry)
    ? "variant"
    : entry.kind;
}

/**
 * Render only an available current preview; comparisons stay independently
 * usable. A removed variant names itself, never its surviving parent, as the
 * component explorer contract requires. The frames that the workspace chose
 * stand on the canvas.
 */
export function WorkspaceStage({
  canvas,
  catalogue,
  context,
  data,
  target,
  variantRemoved,
}: {
  canvas: WorkspaceCanvas;
  catalogue: Catalogue;
  context: ShellContext;
  data: WorkspaceData;
  target: RouteTarget;
  variantRemoved: boolean;
}) {
  if (data.removed) return <RemovedState kind={removedSubject(data.entry)} />;
  if (variantRemoved) return <RemovedVariantState />;
  return (
    <TargetStage
      canvas={canvas}
      catalogue={catalogue}
      target={target}
      {...(context.fragment ? { fragment: context.fragment } : {})}
    />
  );
}
