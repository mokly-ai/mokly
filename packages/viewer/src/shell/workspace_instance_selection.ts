/** Instance selection and Props focus for one routed workspace. */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import type { InspectorHandle } from "@mokly/ui/inspector";

import type { GeneratedComponentView } from "../components/views.js";

import { workspaceFrameSessions } from "./frame_instances.js";
import { useOptionalShellFrameRegistry } from "./frame_registry.js";
import { useInstanceBoxModel } from "./instance_box_model.js";
import { useShellStore } from "./store_context.js";
import type { WorkspaceData } from "./workspace_data.js";

/** Keep instance selection across preview changes and focus Props after a pick. */
export function useWorkspaceInstanceSelection(
  data: WorkspaceData,
  views: readonly GeneratedComponentView[],
  inspectorRef: RefObject<InspectorHandle | null>,
) {
  const store = useShellStore();
  const entryPath = data.entry.path;
  const registry = useOptionalShellFrameRegistry();
  const subscribe = useCallback(
    (listener: () => void) => registry?.subscribe(listener) ?? (() => {}),
    [registry],
  );
  const snapshot = useCallback(() => registry?.snapshot() ?? 0, [registry]);
  useSyncExternalStore(subscribe, snapshot, () => 0);
  const viewport = store.state.selection.viewport;
  const [activeViewport, setActiveViewport] = useState<"desktop" | "mobile">(
    viewport === "mobile" ? "mobile" : "desktop",
  );
  const [selectedKey, setSelectedKey] = useState<string | undefined>(
    store.state.route.instance,
  );
  const openedInstance = useRef<string | undefined>(undefined);
  const resolvedViewport = views.some(
    (view) => view.viewport === activeViewport,
  )
    ? activeViewport
    : (views[0]?.viewport ?? activeViewport);
  const activeView =
    views.find((view) => view.viewport === resolvedViewport) ?? views[0];
  const selectedInstance = activeView?.usage?.instances.find(
    (instance) => instance.key === selectedKey,
  );
  const session =
    registry && activeView
      ? workspaceFrameSessions(registry.values(), data, [activeView])[0]
      : undefined;
  const boxModel = useInstanceBoxModel(registry, session, selectedKey);

  useEffect(() => {
    setActiveViewport(
      store.state.route.viewport === "mobile" ? "mobile" : "desktop",
    );
    setSelectedKey(store.state.route.instance);
  }, [entryPath, store.state.route.instance, store.state.route.viewport]);

  useEffect(() => {
    if (selectedKey && activeView?.usage && !selectedInstance)
      setSelectedKey(undefined);
  }, [activeView?.usage, selectedInstance, selectedKey]);

  useEffect(() => {
    if (!selectedInstance) {
      openedInstance.current = undefined;
      return;
    }
    if (openedInstance.current === selectedInstance.key) return;
    openedInstance.current = selectedInstance.key;
    store.setDetails(true, "props");
  }, [selectedInstance, store]);

  const selectInstance = useCallback(
    (key: string, nextViewport: "desktop" | "mobile", openProps = true) => {
      openedInstance.current = key;
      setActiveViewport(nextViewport);
      setSelectedKey(key);
      if (!openProps) return;
      store.setExpandedFrame(undefined);
      store.setDetails(true, "props");
      queueMicrotask(() => inspectorRef.current?.focusTab("props"));
    },
    [store],
  );
  return {
    selectedInstance,
    boxModel,
    selectedKey,
    resolvedViewport,
    activeView,
    setActiveViewport,
    selectInstance,
  };
}
