/**
 * The canvas selection of a screen's or a component's workspace. In
 * Inspect, a click on a frame selects the innermost instance under the
 * pointer, unless the click follows a link, and a host pick takes the click
 * in either tab. The empty canvas and Escape clear the selection. A route's
 * instance and a variant set's routed saved variant select on arrival. Each
 * frame's session tells the selection when the frame's document is replaced
 * or the instance leaves its ready usage. The workspace holds the state, so
 * the compact layout can show a variant set's selected frame alone.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type Dispatch,
} from "react";

import {
  canvasFrameStates,
  frameSessions,
  frameStatesSignature,
  routeSelection,
  sessionFrame,
} from "./canvas_selection_frames.js";
import {
  canvasSelectionReducer,
  NO_SELECTION,
  type CanvasSelected,
  type CanvasSelectionAction,
  type CanvasSelectionState,
} from "./canvas_selection.js";
import type { CanvasFramePlan } from "./canvas_frames.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameSession,
} from "./frame_registry.js";
import { useShellRoot } from "./root_context.js";
import { useShellStore } from "./store_context.js";

/** The canvas selection, and how a reader changes it. */
export interface WorkspaceCanvasSelection {
  state: CanvasSelectionState;
  /** The mounted session of each frame, by the frame's key. */
  sessions: ReadonlyMap<string, ShellFrameSession>;
  clear(): void;
  /** Ask Inspect to scroll to its Selection section again. */
  reveal(): void;
  /** Select a frame of a variant set. */
  selectFrame(frame: string): void;
  /** Select an instance on a frame; `reveal` scrolls Inspect to Selection. */
  selectInstance(frame: string, key: string, reveal: boolean): void;
}

/**
 * The state of the canvas selection, which the workspace holds. `routed`
 * is what the route selects from the first render, such as a variant set's
 * routed saved variant's frame.
 */
export function useCanvasSelectionState(
  routed: CanvasSelected | undefined,
): [CanvasSelectionState, Dispatch<CanvasSelectionAction>] {
  return useReducer(canvasSelectionReducer, routed, (selected) =>
    selected ? { ...NO_SELECTION, selected } : NO_SELECTION,
  );
}

/** Whether a key press belongs to a text field, which keeps its Escape. */
function inTextField(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, select, textarea, [contenteditable]") !== null
  );
}

export function useCanvasSelection({
  dispatch,
  plans,
  routed,
  selecting,
  set,
  state,
}: {
  dispatch: Dispatch<CanvasSelectionAction>;
  /** Every frame of the canvas, the hidden ones included. */
  plans: readonly CanvasFramePlan[];
  /**
   * The routed entry, whether it is a saved variant of a set, and the scheme
   * of the frame that a routed variant selects.
   */
  routed: { path: string; savedVariant: boolean; scheme: "dark" | "light" };
  /** Whether a click on a frame selects, as it does in Inspect. */
  selecting: boolean;
  /** Whether the canvas holds a variant set. */
  set: boolean;
  state: CanvasSelectionState;
}): WorkspaceCanvasSelection {
  const store = useShellStore();
  const registry = useOptionalShellFrameRegistry();
  const subscribe = useCallback(
    (listener: () => void) => registry?.subscribe(listener) ?? (() => {}),
    [registry],
  );
  const snapshot = useCallback(() => registry?.snapshot() ?? 0, [registry]);
  const revision = useSyncExternalStore(subscribe, snapshot, () => 0);
  const sessions = useMemo(
    () => frameSessions(registry?.values() ?? [], plans),
    [plans, registry, revision],
  );
  const frames = useMemo(
    () => canvasFrameStates(plans, sessions),
    [plans, sessions],
  );
  // A route's instance can wait for a frame that is ready already.
  const signature = frameStatesSignature(frames);
  useEffect(() => {
    dispatch({ type: "reconcile", frames, set });
  }, [signature, set, state.pending]);

  // Each route installation names its own selection.
  const installation = store.state.routeInstallation;
  const latestPlans = useRef(plans);
  latestPlans.current = plans;
  useEffect(() => {
    const named = routeSelection(store.state.route, latestPlans.current, routed);
    dispatch(
      named === undefined
        ? { type: "route" }
        : "instance" in named
          ? { type: "route", instance: named.instance }
          : { type: "route", frame: named.frame },
    );
  }, [installation, routed.path]);

  // A click selects; the navigation of a link that the same click follows
  // takes the selection back, so the click selects nothing.
  const latest = useRef({ selecting, sessions, state });
  latest.current = { selecting, sessions, state };
  useEffect(() => {
    if (!registry) return;
    let click: { before: CanvasSelectionState; session: ShellFrameSession };
    let clicked = false;
    return registry.subscribeEvents((session, event) => {
      const current = latest.current;
      if (event.type === "navigation" && clicked && click.session === session) {
        clicked = false;
        dispatch({ type: "restore", state: click.before });
        return;
      }
      if (event.type !== "click") return;
      clicked = false;
      const frame = sessionFrame(current.sessions, session);
      const pick = registry.inspection.getSnapshot().active?.kind === "pick";
      if (!frame || !current.selecting || pick) return;
      click = { before: current.state, session };
      clicked = true;
      dispatch({
        type: "select",
        generation: session.generation,
        selected: { kind: "instance", frame, key: event.key },
        reveal: true,
      });
    });
  }, [registry]);

  // Escape clears the selection, unless a text field or another part of
  // the shell took it.
  const root = useShellRoot()?.elements.root;
  useEffect(() => {
    const element = root?.current;
    if (!element) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        inTextField(event.target) ||
        !latest.current.selecting ||
        !latest.current.state.selected
      )
        return;
      dispatch({ type: "clear" });
    };
    element.addEventListener("keydown", escape);
    return () => element.removeEventListener("keydown", escape);
  }, [root]);

  return useMemo(
    () => ({
      state,
      sessions,
      clear: () => dispatch({ type: "clear" }),
      reveal: () => dispatch({ type: "reveal" }),
      selectFrame: (frame: string) =>
        dispatch({
          type: "select",
          generation: sessions.get(frame)?.generation,
          selected: { kind: "frame", frame },
          reveal: true,
        }),
      selectInstance: (frame: string, key: string, reveal: boolean) =>
        dispatch({
          type: "select",
          generation: sessions.get(frame)?.generation,
          selected: { kind: "instance", frame, key },
          reveal,
        }),
    }),
    [dispatch, sessions, state],
  );
}
