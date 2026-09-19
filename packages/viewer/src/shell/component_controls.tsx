/** Local temporary prop editing with cancellable provider-backed previews. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";

import type { ViewerCapabilityRequest } from "../client/host_capability_descriptor.js";
import type { ComponentWireProps } from "../components/prop_types.js";
import type { ComponentOverride } from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import { useViewerCapabilities } from "./capability_context.js";
import {
  controlDraft,
  validateControlDraft,
  type ControlDraft,
  type ControlDraftField,
} from "./component_control_fields.js";
import { ComponentControlsPanel } from "./component_controls_panel.js";
import {
  controlsUnavailable,
  controlViewKey,
  initialComponentEditorState,
} from "./component_controls_state.js";
import { useComponentPreviewExpiration } from "./component_preview_expiration.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** Control output consumed by both the stage and Props panel. */
export interface ComponentControlsResult {
  panel: ReactNode;
  previewViews: readonly GeneratedComponentView[];
  props?: ComponentWireProps;
}

/** Own one component variant's edit lifecycle. */
export function useComponentControls({
  comparing,
  contexts,
  data,
  request,
  variant,
  workspaceRef,
}: {
  comparing: boolean;
  contexts: readonly GeneratedComponentView[];
  data: WorkspaceData;
  request?: ViewerCapabilityRequest | undefined;
  variant?: WorkspaceVariant | undefined;
  workspaceRef: RefObject<HTMLElement | null>;
}): ComponentControlsResult {
  const capabilities = useViewerCapabilities();
  const component = data.entry.kind === "component" ? data.entry : undefined;
  const generation = request?.source.renderGeneration;
  const scope = `${variant?.value.id ?? "none"}/${comparing}/${generation ?? "static"}/${variant ? JSON.stringify(variant.value.props) : ""}`;
  const initial = useMemo(
    () =>
      initialComponentEditorState(
        component,
        variant,
        scope,
        component && variant ? controlDraft(component, variant) : {},
      ),
    [component, scope, variant],
  );
  const [stored, setStored] = useState(initial);
  const state = stored.scope === scope ? stored : initial;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef<AbortController | undefined>(undefined);
  const sequence = useRef(0);
  const pageIds = useRef(new Map<string, string>());
  const unavailable = controlsUnavailable(
    data,
    variant,
    comparing,
    Boolean(capabilities?.temporaryPreviews && request && generation),
  );
  const contextKey = contexts.map(controlViewKey).join("|");

  const cancel = useCallback(() => {
    sequence.current += 1;
    clearTimeout(timer.current);
    timer.current = undefined;
    active.current?.abort();
    active.current = undefined;
  }, []);

  const render = useCallback(
    async (
      draft: ControlDraft,
      overrides: Readonly<Record<string, ComponentOverride>>,
    ) => {
      if (
        !component ||
        !variant ||
        !request ||
        !generation ||
        !capabilities?.temporaryPreviews ||
        unavailable
      )
        return;
      const operation = sequence.current;
      const controller = new AbortController();
      active.current = controller;
      setStored((current) =>
        current.scope === scope
          ? { ...current, failure: undefined, status: "Updating preview…" }
          : current,
      );
      try {
        const results = await Promise.all(
          contexts.map((view) => {
            const key = controlViewKey(view);
            const pageId =
              pageIds.current.get(key) ??
              globalThis.crypto.randomUUID().replaceAll("-", "");
            pageIds.current.set(key, pageId);
            return capabilities.temporaryPreviews!.render(
              request,
              {
                componentId: component.id,
                variantId: variant.value.id,
                viewport: view.viewport,
                colorScheme: view.colorScheme,
                generation,
                pageId,
                overrides,
              },
              view,
              controller.signal,
            );
          }),
        );
        if (controller.signal.aborted || operation !== sequence.current) return;
        setStored((current) => {
          if (current.scope !== scope) return current;
          const previews = new Map(current.previews);
          for (const result of results)
            previews.set(controlViewKey(result.view), result);
          return {
            ...current,
            draft,
            dirty: true,
            failure: undefined,
            previews,
            props: results[0]?.props ?? current.props,
            status: "Edited props",
          };
        });
      } catch (error) {
        if (controller.signal.aborted || operation !== sequence.current) return;
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
    [
      capabilities,
      component,
      contexts,
      generation,
      request,
      scope,
      unavailable,
      variant,
    ],
  );

  const edit = useCallback(
    (draft: ControlDraft, immediate: boolean) => {
      if (!component || !variant || unavailable) return;
      cancel();
      const validated = validateControlDraft(component, variant, draft);
      if (!validated.overrides) {
        setStored((current) => ({
          ...current,
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
        ...current,
        draft,
        dirty: true,
        errors: {},
        failure: undefined,
      }));
      const submit = () => void render(draft, validated.overrides!);
      if (immediate) submit();
      else timer.current = setTimeout(submit, 150);
    },
    [cancel, component, initial, render, unavailable, variant],
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
    capabilities,
    onExpired: expire,
    previews: state.previews,
    request,
    workspaceRef,
  });
  const previousContext = useRef(contextKey);
  useEffect(() => {
    if (previousContext.current === contextKey) return;
    previousContext.current = contextKey;
    if (state.dirty && !unavailable) edit(state.draft, true);
  }, [contextKey, edit, state.dirty, state.draft, unavailable]);

  const change = (key: string, field: ControlDraftField, immediate: boolean) =>
    edit({ ...state.draft, [key]: field }, immediate);
  const reset = () => {
    cancel();
    setStored(initial);
  };
  const retry = () => {
    if (!component || !variant) return;
    cancel();
    const validated = validateControlDraft(component, variant, state.draft);
    if (validated.overrides) void render(state.draft, validated.overrides);
  };
  const previews = useMemo(
    () =>
      data.views.map((view) => {
        const preview = state.previews.get(controlViewKey(view));
        return preview && view.variantId === variant?.value.id
          ? {
              ...view,
              path: decodeURIComponent(preview.previewUrl),
              usage: preview.view,
            }
          : view;
      }),
    [data.views, state.previews, variant?.value.id],
  );
  return {
    panel: (
      <ComponentControlsPanel
        component={component}
        data={data}
        disabled={Boolean(unavailable)}
        onChange={change}
        onReset={reset}
        onRetry={retry}
        state={state}
        status={unavailable ?? state.status}
        variant={variant}
      />
    ),
    previewViews: previews,
    ...(variant ? { props: state.props } : {}),
  };
}
