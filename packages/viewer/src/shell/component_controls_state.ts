/** Shared state and scope helpers for temporary prop editing. */

import { decodeProps } from "../components/codec.js";
import type { ComponentWireProps } from "../components/prop_types.js";
import {
  ComponentRenderError,
  type ComponentRenderSuccess,
} from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import {
  WHOLE_PROPS_ERROR,
  type ControlDraft,
  type ControlTarget,
} from "./control_values.js";
import type { LiveEditingStatus } from "./data_descriptor.js";

/**
 * What the panel says about the edits: the reset confirmation, a render in
 * flight, or why the preview shows other props than the fields.
 */
export type ControlsNotice =
  | "restored"
  | "pending"
  | "invalid"
  | "invalid-together"
  | "failed"
  | "expired";

/** One edit scope's current draft and last valid previews. */
export interface ComponentEditorState {
  draft: ControlDraft;
  errors: Readonly<Record<string, string>>;
  dirty: boolean;
  notice: ControlsNotice | undefined;
  previews: ReadonlyMap<string, ComponentRenderSuccess>;
  props: ComponentWireProps;
  scope: string;
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
    dirty: false,
    notice: undefined,
    previews: new Map(),
    props: target?.props ?? {},
    scope,
  };
}

/**
 * The state the panel shows. Edits of the shown scope stay; a reset shows
 * the current saved props with its confirmation; otherwise the saved props
 * show. The saved props are compared by scope, not identity, because the
 * workspace builds its target again on every render.
 */
export function shownEditorState(
  stored: ComponentEditorState,
  initial: ComponentEditorState,
): ComponentEditorState {
  if (stored.scope !== initial.scope) return initial;
  if (stored.dirty) return stored;
  return stored.notice === "restored"
    ? { ...initial, notice: "restored" }
    : initial;
}

/**
 * What the Props panel offers: fields to edit, fields that wait for or
 * failed to start editing in Serve, or the saved props without fields.
 */
export type ControlsMode =
  | "editable"
  | "preparing"
  | "preparing-failed"
  | "comparison"
  | "published"
  | "removed"
  | "read-only"
  | "no-props";

/** The Props panel's mode for the shown entry in the current product context. */
export function controlsMode(
  target: ControlTarget,
  comparing: boolean,
  editing: LiveEditingStatus | undefined,
): ControlsMode {
  if (target.removed) return "removed";
  if (!Object.keys(target.controls).length)
    return Object.keys(decodeProps(target.props)).length ||
      target.suppliedSlots.length
      ? "read-only"
      : "no-props";
  if (comparing) return "comparison";
  if (editing === "ready") return "editable";
  if (editing === "preparing") return "preparing";
  return editing === "failed" ? "preparing-failed" : "published";
}

/** A rejected draft names its fields, or says its values fail together. */
export function draftNotice(
  errors: Readonly<Record<string, string>>,
): ControlsNotice {
  return Object.hasOwn(errors, WHOLE_PROPS_ERROR)
    ? "invalid-together"
    : "invalid";
}

/**
 * A failed render keeps the edits and the last valid preview. The shell
 * checks each field and the props as a whole first, so Serve's 400 means
 * the values fail together. A 409 stays pending: the shell renders again
 * once it adopts the new revision.
 */
export function withRenderFailure(
  state: ComponentEditorState,
  error: unknown,
): ComponentEditorState {
  const code = error instanceof ComponentRenderError ? error.code : undefined;
  if (code === "stale-revision") return { ...state, notice: "pending" };
  return {
    ...state,
    notice: code === "invalid-input" ? "invalid-together" : "failed",
  };
}

/** Serve discarded the previews: the stage shows the saved props, the edits stay. */
export function withExpiredPreview(
  state: ComponentEditorState,
): ComponentEditorState {
  return { ...state, notice: "expired", previews: new Map() };
}

/** Context identity for saved and temporary preview results. */
export function controlViewKey(
  view: Pick<GeneratedComponentView, "colorScheme" | "viewport">,
): string {
  return `${view.viewport}/${view.colorScheme}`;
}

/**
 * Swap the shown entry's saved views for their accepted temporary previews.
 * Without previews the saved array itself returns, and one set of previews
 * gives one array per owner: the workspace keys its frame sessions and their
 * presentation on this array, so a new array on every render would claim the
 * inspection again on every commit.
 */
export function withPreviews(
  views: readonly GeneratedComponentView[],
  previews: ReadonlyMap<string, ComponentRenderSuccess>,
  target: ControlTarget | undefined,
): readonly GeneratedComponentView[] {
  if (!target || !previews.size) return views;
  const byPreviews = projections.get(views) ?? new WeakMap();
  projections.set(views, byPreviews);
  const byOwner = byPreviews.get(previews) ?? new Map();
  byPreviews.set(previews, byOwner);
  const owner = `${target.kind}:${target.path}`;
  const shown =
    byOwner.get(owner) ??
    views.map((view) => {
      const preview = previews.get(controlViewKey(view));
      const owned =
        target.kind === "component"
          ? view.variantPath === target.path
          : view.variantPath === undefined;
      return preview && owned ? previewedView(view, preview) : view;
    });
  byOwner.set(owner, shown);
  return shown;
}

const projections = new WeakMap<
  readonly GeneratedComponentView[],
  WeakMap<
    ReadonlyMap<string, ComponentRenderSuccess>,
    Map<string, readonly GeneratedComponentView[]>
  >
>();

/**
 * One previewed view per saved view and accepted render. Every workspace
 * render then hands its frames the same view and usage record; a new record
 * each time would make each mounted frame adopt usage again, which renders
 * the workspace again without end.
 */
const previewedViews = new WeakMap<
  ComponentRenderSuccess,
  WeakMap<GeneratedComponentView, GeneratedComponentView>
>();

function previewedView(
  view: GeneratedComponentView,
  preview: ComponentRenderSuccess,
): GeneratedComponentView {
  const known = previewedViews.get(preview) ?? new WeakMap();
  previewedViews.set(preview, known);
  const shown = known.get(view) ?? {
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
  };
  known.set(view, shown);
  return shown;
}
