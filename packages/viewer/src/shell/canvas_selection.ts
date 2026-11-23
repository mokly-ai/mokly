/**
 * The canvas selection of one workspace: at most one instance on a frame, or
 * one frame of a variant set. A request to show the selection in Inspect is
 * an event that each selection action makes, not a state that a render
 * derives: the panel scrolls to Selection once for each request, so a
 * render in which a frame's usage lacks the instance, such as while a usage
 * revision replaces it, never asks again. A route's instance waits for its
 * frame's ready usage and applies once. A frame's replacement, and an
 * instance that leaves its frame's ready usage, clear an instance; on a
 * variant set the frame stays selected, so its Props keep their variant.
 */

/** What the canvas holds selected. */
export type CanvasSelected =
  | { kind: "frame"; frame: string }
  | { kind: "instance"; frame: string; key: string };

/** The state of each frame that the selection follows. */
export interface CanvasFrameState {
  /** The generation of the frame's document, while it is mounted. */
  generation: number | undefined;
  /** Whether the frame stands on the canvas. */
  shown: boolean;
  /** The keys of the frame's ready usage, or none while it is not ready. */
  usage: ReadonlySet<string> | undefined;
}

export interface CanvasSelectionState {
  /** The generation of the document that holds the selected instance. */
  generation: number | undefined;
  /** A route's instance that waits for its frame's ready usage. */
  pending: { frame: string; key: string } | undefined;
  /** Counts the requests to scroll Inspect to its Selection section. */
  reveal: number;
  selected: CanvasSelected | undefined;
}

export const NO_SELECTION: CanvasSelectionState = {
  generation: undefined,
  pending: undefined,
  reveal: 0,
  selected: undefined,
};

export type CanvasSelectionAction =
  | {
      type: "select";
      /** The generation of the selected frame's document, if it is mounted. */
      generation: number | undefined;
      selected: CanvasSelected;
      reveal: boolean;
    }
  | { type: "clear" }
  | { type: "restore"; state: CanvasSelectionState }
  | { type: "reveal" }
  | { type: "route"; instance?: { frame: string; key: string }; frame?: string }
  | {
      type: "reconcile";
      frames: ReadonlyMap<string, CanvasFrameState>;
      /** Whether a cleared instance leaves its frame selected. */
      set: boolean;
    };

function selectedNow(
  state: CanvasSelectionState,
  selected: CanvasSelected | undefined,
): CanvasSelectionState {
  return { ...state, generation: undefined, pending: undefined, selected };
}

/** The selection after an instance leaves its frame. */
function withoutInstance(
  state: CanvasSelectionState,
  frame: string,
  set: boolean,
): CanvasSelectionState {
  return selectedNow(state, set ? { kind: "frame", frame } : undefined);
}

function reconciled(
  state: CanvasSelectionState,
  frames: ReadonlyMap<string, CanvasFrameState>,
  set: boolean,
): CanvasSelectionState {
  const pending = state.pending;
  if (pending) {
    const frame = frames.get(pending.frame);
    if (!frame?.usage) return state;
    if (!frame.usage.has(pending.key)) return { ...state, pending: undefined };
    return {
      generation: frame.generation,
      pending: undefined,
      reveal: state.reveal + 1,
      selected: { kind: "instance", ...pending },
    };
  }
  const selected = state.selected;
  if (!selected) return state;
  const frame = frames.get(selected.frame);
  if (!frame?.shown) return selectedNow(state, undefined);
  if (selected.kind === "frame") return state;
  if (state.generation !== undefined && frame.generation !== state.generation)
    return withoutInstance(state, selected.frame, set);
  if (frame.usage && !frame.usage.has(selected.key))
    return withoutInstance(state, selected.frame, set);
  if (state.generation === undefined && frame.generation !== undefined)
    return { ...state, generation: frame.generation };
  return state;
}

export function canvasSelectionReducer(
  state: CanvasSelectionState,
  action: CanvasSelectionAction,
): CanvasSelectionState {
  switch (action.type) {
    case "select":
      return {
        ...selectedNow(state, action.selected),
        generation: action.generation,
        reveal: state.reveal + (action.reveal ? 1 : 0),
      };
    case "clear":
      return state.selected || state.pending
        ? selectedNow(state, undefined)
        : state;
    case "restore":
      return action.state;
    case "reveal":
      return { ...state, reveal: state.reveal + 1 };
    case "route":
      if (action.instance)
        return { ...selectedNow(state, undefined), pending: action.instance };
      if (action.frame)
        return {
          ...selectedNow(state, { kind: "frame", frame: action.frame }),
          reveal: state.reveal + 1,
        };
      return state.selected || state.pending
        ? selectedNow(state, undefined)
        : state;
    case "reconcile":
      return reconciled(state, action.frames, action.set);
  }
}
