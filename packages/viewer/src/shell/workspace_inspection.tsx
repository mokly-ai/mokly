/** Registry-backed component inspection for the React workspace. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { ShellInspectionClaim } from "./frame_inspection_types.js";
import {
  frameHasInstance,
  frameInstanceRef,
  workspaceFrameSessions,
} from "./frame_instances.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameSession,
} from "./frame_registry.js";
import {
  useWorkspaceInspectionGeometry,
  workspaceSessionSignature,
} from "./workspace_inspection_geometry.js";
import {
  workspaceHighlightLabels,
  WorkspaceInspectionOverlay,
} from "./workspace_inspection_labels.js";
import {
  focusWorkspaceHighlightControl,
  inspectionAvailability,
  presentWorkspaceInspection,
  receiveWorkspaceFrameEvent,
  WAITING_REASON,
  workspaceInspectionKeys,
  type WorkspaceInspectionInput,
  type WorkspaceInspectionResult,
} from "./workspace_inspection_runtime.js";

/** Own workspace masks, labels, selection events, and geometry refreshes. */
export function useWorkspaceInspection(
  input: WorkspaceInspectionInput,
): WorkspaceInspectionResult {
  const registry = useOptionalShellFrameRegistry();
  const subscribe = useCallback(
    (listener: () => void) => registry?.subscribe(listener) ?? (() => {}),
    [registry],
  );
  const snapshot = useCallback(() => registry?.snapshot() ?? 0, [registry]);
  const revision = useSyncExternalStore(subscribe, snapshot, () => 0);
  const inspection = registry?.inspection;
  const subscribeInspection = useCallback(
    (listener: () => void) => inspection?.subscribe(listener) ?? (() => {}),
    [inspection],
  );
  const inspectionSnapshot = useCallback(
    () => inspection?.getSnapshot().active?.id ?? 0,
    [inspection],
  );
  const activeInspection = useSyncExternalStore(
    subscribeInspection,
    inspectionSnapshot,
    () => 0,
  );
  const sessions = useMemo(
    () =>
      registry
        ? workspaceFrameSessions(registry.values(), input.data, input.views)
        : [],
    [input.data, input.views, registry, revision],
  );
  const [highlighting, setHighlighting] = useState(false);
  const [presentationFailed, setPresentationFailed] = useState(false);
  const demanded = useRef<readonly ShellFrameSession[]>([]);
  const claim = useRef<ShellInspectionClaim | undefined>(undefined);
  const mounted = useRef(true);
  const latest = useRef({ input, registry, sessions, highlighting });
  const workspaceHighlighting = Boolean(
    highlighting &&
    claim.current?.id === activeInspection &&
    inspection?.current(claim.current),
  );
  const baseAvailability = inspectionAvailability(input, sessions);
  const availability = presentationFailed
    ? {
        available: false,
        reason: "Component inspection is unavailable for this view.",
      }
    : baseAvailability;
  latest.current = {
    input,
    registry,
    sessions,
    highlighting: workspaceHighlighting,
  };
  demanded.current =
    workspaceHighlighting && availability.available ? sessions : [];

  const clearPresentation = useCallback((focus: boolean): void => {
    const currentClaim = claim.current;
    claim.current = undefined;
    latest.current.highlighting = false;
    setHighlighting(false);
    const state = latest.current;
    if (currentClaim) state.registry?.inspection.release(currentClaim);
    if (focus) focusWorkspaceHighlightControl(state.sessions[0]?.element);
  }, []);

  const reveal = useCallback(
    (key: string, viewport: "desktop" | "mobile"): void => {
      const state = latest.current;
      const target = state.sessions.find(
        (session) =>
          session.identity.viewport === viewport &&
          frameHasInstance(session, key),
      );
      const instance = target ? frameInstanceRef(target, key) : undefined;
      if (!state.registry || !target || !instance) return;
      void state.registry.inspection
        .scrollToInstance(instance, [target])
        .catch(() => undefined);
    },
    [],
  );

  const select = useCallback(
    (key: string, viewport: "desktop" | "mobile", openProps = true): void => {
      const state = latest.current;
      if (
        !state.sessions.some(
          (session) =>
            session.identity.viewport === viewport &&
            frameHasInstance(session, key),
        )
      )
        return;
      state.input.onSelect(key, viewport, openProps);
      if (
        state.registry &&
        inspectionAvailability(state.input, state.sessions).available
      ) {
        const currentClaim = claim.current;
        if (!currentClaim || !state.registry.inspection.current(currentClaim))
          claim.current = state.registry.inspection.claim("workspace");
        state.highlighting = true;
        setHighlighting(true);
      }
      if (openProps) reveal(key, viewport);
    },
    [reveal],
  );

  const stop = useCallback(() => clearPresentation(false), [clearPresentation]);
  const toggle = useCallback(() => {
    const state = latest.current;
    if (state.highlighting) clearPresentation(false);
    else if (
      state.registry &&
      inspectionAvailability(state.input, state.sessions).available
    ) {
      claim.current = state.registry.inspection.claim("workspace");
      state.highlighting = true;
      setHighlighting(true);
    }
  }, [clearPresentation]);

  const root = sessions[0]?.element.closest<HTMLElement>("[data-workspace]");
  const sessionSignature = workspaceSessionSignature(sessions);
  const geometry = useWorkspaceInspectionGeometry(
    root,
    demanded,
    setPresentationFailed,
  );
  useEffect(
    () => setPresentationFailed(false),
    [input.data.entry.id, input.views, sessionSignature],
  );

  useEffect(() => {
    if (!highlighting) return;
    const currentClaim = claim.current;
    if (
      currentClaim &&
      currentClaim.id === activeInspection &&
      inspection?.current(currentClaim)
    )
      return;
    claim.current = undefined;
    latest.current.highlighting = false;
    setHighlighting(false);
  }, [activeInspection, highlighting, inspection]);

  useEffect(() => {
    if (!highlighting || !registry) return;
    const currentClaim = claim.current;
    if (!currentClaim || !registry.inspection.current(currentClaim)) return;
    if (!availability.available) {
      if (availability.reason && availability.reason !== WAITING_REASON)
        clearPresentation(false);
      return;
    }
    const presentationClaim = registry.inspection.claim("workspace");
    claim.current = presentationClaim;
    const request = {
      registry,
      sessions,
      ...(input.selectedKey ? { selectedKey: input.selectedKey } : {}),
    };
    void registry.inspection
      .run(presentationClaim, (current) =>
        presentWorkspaceInspection(request, current, geometry),
      )
      .catch(() => {
        if (mounted.current && registry.inspection.current(presentationClaim)) {
          setPresentationFailed(true);
          clearPresentation(false);
        }
      });
  }, [
    availability.available,
    availability.reason,
    clearPresentation,
    highlighting,
    input.selectedKey,
    registry,
    sessionSignature,
    sessions,
  ]);

  useEffect(() => {
    if (!registry) return;
    return registry.inspection.subscribeEvents((session, event) => {
      if (!latest.current.sessions.includes(session)) return;
      receiveWorkspaceFrameEvent(
        event,
        session,
        latest.current.highlighting,
        select,
        () => clearPresentation(true),
      );
    });
  }, [clearPresentation, registry, select]);

  useEffect(() => {
    if (!root || !workspaceHighlighting) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearPresentation(true);
    };
    root.addEventListener("keydown", escape);
    return () => root.removeEventListener("keydown", escape);
  }, [clearPresentation, root, workspaceHighlighting]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const currentClaim = claim.current;
      claim.current = undefined;
      if (currentClaim) registry?.inspection.release(currentClaim);
    };
  }, [registry]);

  const measured =
    workspaceHighlighting && availability.available
      ? sessions.flatMap((session) => {
          const result = geometry?.snapshot(session).result;
          return result?.kind === "ready"
            ? [
                {
                  boundaries: result.boundaries,
                  keys: workspaceInspectionKeys(session, input.selectedKey),
                  session,
                },
              ]
            : [];
        })
      : [];
  const labels = workspaceHighlightLabels(input.data, measured);
  return {
    available: availability.available,
    ...(availability.reason ? { reason: availability.reason } : {}),
    highlighting: workspaceHighlighting,
    select,
    toggle,
    reveal,
    stop,
    overlay: <WorkspaceInspectionOverlay labels={labels} onSelect={select} />,
  };
}
