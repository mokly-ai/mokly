/**
 * The frames that the canvas selection follows: the mounted session of each
 * frame of a workspace's canvas, the state that the selection reads of each
 * frame, and the selection that a route names.
 */

import type { CanvasFramePlan } from "./canvas_frames.js";
import type { CanvasFrameState, CanvasSelected } from "./canvas_selection.js";
import { validFrameUsage } from "./frame_instances.js";
import type { ShellFrameSession } from "./frame_registry.js";
import type { ShellRoute } from "./routes.js";

/** Whether a session shows a frame of the canvas. */
function showsFrame(
  session: ShellFrameSession,
  plan: CanvasFramePlan,
): boolean {
  const identity = session.identity;
  return (
    identity.stepIndex === undefined &&
    identity.entryPath === (plan.variantPath ?? plan.entry.path) &&
    identity.variantPath === plan.variantPath &&
    identity.viewport === plan.viewport &&
    identity.colorScheme === plan.scheme
  );
}

/** The newest mounted session of each frame, by the frame's key. */
export function frameSessions(
  sessions: readonly ShellFrameSession[],
  plans: readonly CanvasFramePlan[],
): ReadonlyMap<string, ShellFrameSession> {
  const found = new Map<string, ShellFrameSession>();
  for (const plan of plans) {
    const newest = sessions
      .filter((session) => showsFrame(session, plan))
      .sort((left, right) => right.generation - left.generation)[0];
    if (newest) found.set(plan.key, newest);
  }
  return found;
}

/** The key of the frame that a session shows, if it shows one. */
export function sessionFrame(
  sessions: ReadonlyMap<string, ShellFrameSession>,
  session: ShellFrameSession,
): string | undefined {
  for (const [key, candidate] of sessions)
    if (candidate === session) return key;
  return undefined;
}

/** The ready usage of a session, as the keys of its instances. */
function readyKeys(
  session: ShellFrameSession | undefined,
): ReadonlySet<string> | undefined {
  if (
    !session ||
    session.status !== "ready" ||
    !validFrameUsage(session) ||
    session.usage.status !== "ready"
  )
    return undefined;
  return new Set(session.usage.instances.map((instance) => instance.key));
}

/** The state that the selection reads of each frame of the canvas. */
export function canvasFrameStates(
  plans: readonly CanvasFramePlan[],
  sessions: ReadonlyMap<string, ShellFrameSession>,
): ReadonlyMap<string, CanvasFrameState> {
  return new Map(
    plans.map((plan) => {
      const session = sessions.get(plan.key);
      return [
        plan.key,
        {
          generation: session?.generation,
          shown: plan.hidden !== true,
          usage: readyKeys(session),
        },
      ];
    }),
  );
}

/** A signature of the frames' states, which changes when one of them does. */
export function frameStatesSignature(
  states: ReadonlyMap<string, CanvasFrameState>,
): string {
  return [...states]
    .map(
      ([key, state]) =>
        `${key}:${state.generation ?? "-"}:${state.shown}:${
          state.usage ? [...state.usage].join(",") : "-"
        }`,
    )
    .join("|");
}

/**
 * The frame of a routed entry in a scheme: a screen's frame of a viewport,
 * or a variant set's row of the entry. A scheme without a frame, such as
 * Dark on a light-only screen, takes the Light frame.
 */
function routedFrame(
  plans: readonly CanvasFramePlan[],
  path: string,
  viewport: "desktop" | "mobile",
  scheme: "dark" | "light",
): CanvasFramePlan | undefined {
  const frames = plans.filter((plan) =>
    plan.kind === "component"
      ? plan.variantPath === path
      : plan.viewport === viewport,
  );
  return (
    frames.find((plan) => plan.scheme === scheme) ??
    frames.find((plan) => plan.scheme === "light")
  );
}

/**
 * The selection that a route names: the instance of a Used by link on the
 * frame of the link's viewport and scheme, or the frame of a variant set's
 * routed saved variant in `routed.scheme`: Light on the wide canvas, and the
 * selection's scheme in the compact layout, which picks that frame.
 */
export function routeSelection(
  route: ShellRoute,
  plans: readonly CanvasFramePlan[],
  routed: { path: string; savedVariant: boolean; scheme: "dark" | "light" },
):
  { instance: { frame: string; key: string } } | { frame: string } | undefined {
  const viewport = route.viewport === "desktop" ? "desktop" : "mobile";
  if (route.instance) {
    const frame = routedFrame(
      plans,
      routed.path,
      viewport,
      route.colorScheme ?? "light",
    );
    return frame
      ? { instance: { frame: frame.key, key: route.instance } }
      : undefined;
  }
  if (!routed.savedVariant) return undefined;
  const frame = routedFrame(plans, routed.path, viewport, routed.scheme);
  return frame?.kind === "component" ? { frame: frame.key } : undefined;
}

/** The selection's instance, if it is on the given frame. */
export function instanceOn(
  selected: CanvasSelected | undefined,
  frame: string,
): string | undefined {
  return selected?.kind === "instance" && selected.frame === frame
    ? selected.key
    : undefined;
}
