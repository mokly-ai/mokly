/** Shared state and scope helpers for temporary prop editing. */

import type { ComponentWireProps } from "../components/prop_types.js";
import type { ComponentRenderSuccess } from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import type { ControlDraft, ControlTarget } from "./control_values.js";

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

/** Reset state for a new entry or comparison mode. */
export function initialComponentEditorState(
  target: ControlTarget | undefined,
  scope: string,
  draft: ControlDraft,
): ComponentEditorState {
  return {
    draft: target ? draft : {},
    errors: {},
    failure: undefined,
    dirty: false,
    previews: new Map(),
    props: target?.props ?? {},
    scope,
    status: "Saved props",
  };
}

/** Explain why controls are read-only in the current product context. */
export function controlsUnavailable(
  target: ControlTarget | undefined,
  comparing: boolean,
  live: boolean,
): string | undefined {
  if (!target || target.removed)
    return "Choose an available entry to edit props.";
  if (comparing)
    return "Comparisons show the saved props. Return to Current to edit props.";
  if (!live) return "Open this catalogue locally to edit props.";
  if (!Object.keys(target.controls).length)
    return "No editable props are declared for this entry.";
}

/** Context identity for saved and temporary preview results. */
export function controlViewKey(
  view: Pick<GeneratedComponentView, "colorScheme" | "viewport">,
): string {
  return `${view.viewport}/${view.colorScheme}`;
}

/** Swap the shown entry's saved views for their accepted temporary previews. */
export function withPreviews(
  views: readonly GeneratedComponentView[],
  previews: ReadonlyMap<string, ComponentRenderSuccess>,
  target: ControlTarget | undefined,
): readonly GeneratedComponentView[] {
  if (!target) return views;
  return views.map((view) => {
    const preview = previews.get(controlViewKey(view));
    const owned =
      target.kind === "component"
        ? view.variantPath === target.path
        : view.variantPath === undefined;
    return preview && owned
      ? {
          ...view,
          path: decodeURIComponent(preview.previewUrl),
          usage: {
            viewport: view.viewport,
            colorScheme: view.colorScheme,
            instances: preview.usage.instances,
            slots: preview.usage.slots,
            ranges: preview.usage.ranges,
            styles: [],
            resources: [],
          },
        }
      : view;
  });
}
