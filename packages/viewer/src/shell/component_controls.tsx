/** Temporary prop editing of the shown entry with cancellable live renders. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";

import type { ComponentWireProps } from "../components/prop_types.js";
import type { ComponentOverride } from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import { ComponentControlsPanel } from "./component_controls_panel.js";
import {
  controlsUnavailable,
  controlViewKey,
  initialComponentEditorState,
  withPreviews,
} from "./component_controls_state.js";
import {
  acceptedRender,
  editContextKey,
  EditLifecycle,
  shouldRerender,
} from "./component_edit_lifecycle.js";
import { useComponentPreviewExpiration } from "./component_preview_expiration.js";
import {
  controlDraft,
  validateControlDraft,
  type ControlDraft,
  type ControlDraftField,
  type ControlTarget,
} from "./control_values.js";
import { useViewerCapabilities } from "./data_context.js";
import type { WorkspaceData } from "./workspace_data.js";

/** Control output consumed by both the stage and the Props panel. */
export interface ComponentControlsResult {
  panel: ReactNode;
  previewViews: readonly GeneratedComponentView[];
  props?: ComponentWireProps;
}

/** Own the edit lifecycle of the shown screen, component or variant. */
export function useComponentControls({
  comparing,
  contexts,
  data,
  target,
  workspaceRef,
}: {
  comparing: boolean;
  contexts: readonly GeneratedComponentView[];
  data: WorkspaceData;
  target: ControlTarget | undefined;
  workspaceRef: RefObject<HTMLElement | null>;
}): ComponentControlsResult {
  const capabilities = useViewerCapabilities();
  const previews = capabilities?.temporaryPreviews;
  const latestPreviews = useRef(previews);
  latestPreviews.current = previews;
  const scope = `${target?.path ?? "none"}/${comparing}`;
  const initial = useMemo(
    () =>
      initialComponentEditorState(
        target,
        scope,
        target ? controlDraft(target) : {},
      ),
    [scope, target],
  );
  const [stored, setStored] = useState(initial);
  const state =
    stored.scope === scope && (stored.dirty || stored === initial)
      ? stored
      : initial;
  const [lifecycle] = useState(() => new EditLifecycle());
  const pageIds = useRef(new Map<string, string>());
  const unavailable = controlsUnavailable(target, comparing, Boolean(previews));
  const contextKey = editContextKey(contexts, previews);
  const cancel = useCallback(() => lifecycle.cancel(), [lifecycle]);

  const render = useCallback(
    async (
      draft: ControlDraft,
      overrides: Readonly<Record<string, ComponentOverride>>,
    ) => {
      const live = latestPreviews.current;
      if (!target || !live || unavailable) return;
      const operation = lifecycle.begin();
      setStored((current) =>
        current.scope === scope
          ? { ...current, failure: undefined, status: "Updating preview…" }
          : current,
      );
      try {
        const results = await Promise.all(
          contexts.map(async (view) => {
            const key = controlViewKey(view);
            const pageId =
              pageIds.current.get(key) ??
              globalThis.crypto.randomUUID().replaceAll("-", "");
            pageIds.current.set(key, pageId);
            const result = await live.render(
              {
                entryPath: target.path,
                viewport: view.viewport,
                colorScheme: view.colorScheme,
                pageId,
                overrides,
              },
              operation.signal,
            );
            return [key, result] as const;
          }),
        );
        if (
          !operation.current() ||
          !acceptedRender(results, latestPreviews.current)
        )
          return;
        setStored((current) => {
          if (current.scope !== scope) return current;
          const next = new Map(current.previews);
          for (const [key, result] of results) next.set(key, result);
          return {
            ...current,
            draft,
            dirty: true,
            failure: undefined,
            previews: next,
            props: results[0]?.[1].props ?? current.props,
            status: "Edited props",
          };
        });
      } catch (error) {
        if (!operation.current()) return;
        setStored((current) =>
          current.scope === scope
            ? {
                ...current,
                failure:
                  error instanceof Error
                    ? error.message
                    : "The preview could not be updated. Try again.",
                status: "The preview shows the last valid props.",
              }
            : current,
        );
      }
    },
    [contexts, lifecycle, scope, target, unavailable],
  );

  const edit = useCallback(
    (draft: ControlDraft, immediate: boolean) => {
      if (!target || unavailable) return;
      cancel();
      const validated = validateControlDraft(target, draft);
      if (!validated.overrides) {
        setStored((current) => ({
          ...(current.scope === scope ? current : initial),
          draft,
          dirty: true,
          errors: validated.errors,
          failure: undefined,
          status:
            "Check the highlighted values. The preview shows the last valid props.",
        }));
        return;
      }
      if (!Object.keys(validated.overrides).length) {
        setStored(initial);
        return;
      }
      setStored((current) => ({
        ...(current.scope === scope ? current : initial),
        draft,
        dirty: true,
        errors: {},
        failure: undefined,
      }));
      const overrides = validated.overrides;
      lifecycle.schedule(immediate, () => void render(draft, overrides));
    },
    [cancel, initial, lifecycle, render, scope, target, unavailable],
  );

  useEffect(() => {
    if (stored.scope === scope) return;
    cancel();
    setStored(initial);
  }, [cancel, initial, scope, stored.scope]);
  useEffect(() => () => cancel(), [cancel]);
  const expire = useCallback(
    () =>
      setStored((current) =>
        current.scope === scope
          ? {
              ...current,
              failure: "Render it again to continue with these props.",
              status: "The temporary preview expired.",
            }
          : current,
      ),
    [scope],
  );
  useComponentPreviewExpiration({
    onExpired: expire,
    previews: state.previews,
    temporaryPreviews: previews,
    workspaceRef,
  });
  const previousContext = useRef(contextKey);
  useEffect(() => {
    const previous = previousContext.current;
    previousContext.current = contextKey;
    if (shouldRerender(previous, contextKey, state.dirty, unavailable))
      edit(state.draft, true);
  }, [contextKey, edit, state.dirty, state.draft, unavailable]);

  const change = (key: string, field: ControlDraftField, immediate: boolean) =>
    edit({ ...state.draft, [key]: field }, immediate);
  const reset = () => {
    cancel();
    setStored(initial);
  };
  const retry = () => {
    if (!target) return;
    cancel();
    const validated = validateControlDraft(target, state.draft);
    if (validated.overrides) void render(state.draft, validated.overrides);
  };
  const previewViews = useMemo(
    () => withPreviews(data.views, state.previews, target),
    [data.views, state.previews, target],
  );
  return {
    panel: (
      <ComponentControlsPanel
        data={data}
        disabled={Boolean(unavailable)}
        onChange={change}
        onReset={reset}
        onRetry={retry}
        state={state}
        status={unavailable ?? state.status}
        target={target}
      />
    ),
    previewViews,
    ...(target ? { props: state.props } : {}),
  };
}
