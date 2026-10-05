/** Current workspace preview or its explicit unavailable state. */

import type { GeneratedComponentView } from "../components/views.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { TargetStage } from "./stages.js";
import type { RouteTarget } from "./target.js";
import type { WorkspaceData } from "./workspace_data.js";
import { MovedVariantsStage } from "./workspace_moved_variants.js";

/**
 * Render only an available current preview; comparisons stay independently
 * usable. A removed component without a variant row has nothing to compare,
 * so its stage lists where its variants moved.
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
  if (data.removed && data.entry.kind === "component" && !data.variants.length)
    return <MovedVariantsStage catalogue={catalogue} entry={data.entry} />;
  if (data.removed)
    return (
      <div className="mbk-empty" data-mokly-stage="" data-viewport="both">
        <h2>This {data.entry.kind} was removed</h2>
        <p>
          {data.entry.kind === "component"
            ? "Select a comparison to see the previous version."
            : "There is no current preview to show."}
        </p>
      </div>
    );
  if (variantRemoved)
    return (
      <div
        className="mbk-empty"
        data-mokly-stage=""
        data-viewport="both"
        data-workspace-empty=""
      >
        <p>
          This variant was removed. Select a comparison to see its previous
          version.
        </p>
      </div>
    );
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
