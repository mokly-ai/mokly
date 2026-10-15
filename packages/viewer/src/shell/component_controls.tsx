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

import {
  ComponentControlsPanel,
  PreviewStatus,
} from "./component_controls_panel.js";
import {
  controlsMode,
  controlViewKey,
  draftNotice,
  initialComponentEditorState,
  shownEditorState,
  withExpiredPreview,
  withPreviews,
  withRenderFailure,
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
import { useLiveEditingStart, useViewerCapabilities } from "./data_context.js";
import type { WorkspaceData } from "./workspace_data.js";

/** Control output consumed by both the stage and the Props panel. */
export interface ComponentControlsResult {
  panel: ReactNode;
  /** A render of the edits is in flight; the preview says so. */
  pending: boolean;
  /** The preview's status region, which names a render in flight. */
  previewStatus: ReactNode;
  previewViews: readonly GeneratedComponentView[];
  props?: ComponentWireProps;
}

/** Own the edit lifecycle of the shown screen, component or variant. */
export function useComponentControls({
  comparing,
  contexts,
  data,
  onCurrent,
  target,
  workspaceRef,
}: {
  comparing: boolean;
  contexts: readonly GeneratedComponentView[];
  data: WorkspaceData;
  /** Show Current instead of the comparison. */
  onCurrent(): void;
  target: ControlTarget | undefined;
  workspaceRef: RefObject<HTMLElement | null>;
}): ComponentControlsResult {
  const capabilities = useViewerCapabilities();
  const start = useLiveEditingStart();
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
  const state = shownEditorState(stored, initial);
  const [lifecycle] = useState(() => new EditLifecycle());
  const pageIds = useRef(new Map<string, string>());
  const mode = target
    ? controlsMode(target, comparing, previews ? "ready" : start?.status)
    : undefined;
  const editable = mode === "editable";
  const contextKey = editContextKey(contexts, previews);
  const cancel = useCallback(() => lifecycle.cancel(), [lifecycle]);

  const render = useCallback(
    async (
      draft: ControlDraft,
      overrides: Readonly<Record<string, ComponentOverride>>,
    ) => {
      const live = latestPreviews.current;
      if (!target || !live || !editable) return;
      const operation = lifecycle.begin();
      setStored((current) =>
        current.scope === scope ? { ...current, notice: "pending" } : current,
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
            notice: undefined,
            previews: next,
            props: results[0]?.[1].props ?? current.props,
          };
        });
      } catch (error) {
        if (!operation.current()) return;
        setStored((current) =>
          current.scope === scope ? withRenderFailure(current, error) : current,
        );
      }
    },
    [contexts, editable, lifecycle, scope, target],
  );

  const edit = useCallback(
    (draft: ControlDraft, immediate: boolean) => {
      if (!target || !editable) return;
      cancel();
      const validated = validateControlDraft(target, draft);
      if (!validated.overrides) {
        setStored((current) => ({
          ...(current.scope === scope ? current : initial),
          draft,
          dirty: true,
          errors: validated.errors,
          notice: draftNotice(validated.errors),
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
        notice: undefined,
      }));
      const overrides = validated.overrides;
      lifecycle.schedule(immediate, () => void render(draft, overrides));
    },
    [cancel, editable, initial, lifecycle, render, scope, target],
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
        current.scope === scope ? withExpiredPreview(current) : current,
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
    if (shouldRerender(previous, contextKey, state.dirty, editable))
      edit(state.draft, true);
  }, [contextKey, edit, editable, state.dirty, state.draft]);

  const change = (key: string, field: ControlDraftField, immediate: boolean) =>
    edit({ ...state.draft, [key]: field }, immediate);
  const reset = () => {
    cancel();
    setStored({ ...initial, notice: "restored" });
  };
  const retry = () => {
    if (!target) return;
    cancel();
    const validated = validateControlDraft(target, state.draft);
    if (validated.overrides) void render(state.draft, validated.overrides);
  };
  const pending = state.notice === "pending";
  const previewViews = useMemo(
    () => withPreviews(data.views, state.previews, target),
    [data.views, state.previews, target],
  );
  return {
    panel:
      target && mode ? (
        <ComponentControlsPanel
          data={data}
          mode={mode}
          onChange={change}
          onCurrent={onCurrent}
          onReset={reset}
          onRetry={retry}
          {...(start?.status === "failed" ? { onStart: start.retry } : {})}
          state={state}
          target={target}
        />
      ) : null,
    pending,
    previewStatus: <PreviewStatus pending={pending} />,
    previewViews,
    ...(target ? { props: state.props } : {}),
  };
}
