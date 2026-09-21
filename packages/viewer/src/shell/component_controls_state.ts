/** Shared state and scope helpers for temporary component prop editing. */

import type { ComponentWireProps } from "../components/prop_types.js";
import type { ComponentRenderSuccess } from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import type { ControlDraft } from "./component_control_fields.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** One edit scope's current draft and last valid previews. */
export interface ComponentEditorState {
  draft: ControlDraft;
  errors: Readonly<Record<string, string>>;
  failure: string | undefined;
  dirty: boolean;
  previews: ReadonlyMap<string, ComponentRenderSuccess>;
  props: ComponentWireProps;
  scope: string;
  status: string;
}

/** Reset state for a new variant, renderer generation, or comparison mode. */
export function initialComponentEditorState(
  component: Extract<WorkspaceData["entry"], { kind: "component" }> | undefined,
  variant: WorkspaceVariant | undefined,
  scope: string,
  draft: ControlDraft,
): ComponentEditorState {
  return {
    draft: component && variant ? draft : {},
    errors: {},
    failure: undefined,
    dirty: false,
    previews: new Map(),
    props: variant?.value.props ?? {},
    scope,
    status: "Saved props",
  };
}

/** Explain why controls are read-only in the current product context. */
export function controlsUnavailable(
  data: WorkspaceData,
  variant: WorkspaceVariant | undefined,
  comparing: boolean,
  live: boolean,
): string | undefined {
  if (!variant || variant.removed)
    return "Choose an available saved variant to edit props.";
  if (comparing)
    return "Comparisons show the saved variant. Return to Current to edit props.";
  if (!live) return "Open this catalogue locally to edit props.";
  if (
    data.entry.kind === "component" &&
    !Object.keys(data.entry.controls).length
  )
    return "No editable props are declared for this component.";
}

/** Context identity for saved and temporary preview results. */
export function controlViewKey(
  view: Pick<GeneratedComponentView, "colorScheme" | "viewport">,
): string {
  return `${view.viewport}/${view.colorScheme}`;
}
