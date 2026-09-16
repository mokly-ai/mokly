import type { CatalogueUsage } from "../catalogue/types.js";
import type {
  FrameAdapter,
  FrameEvent,
  MountedFrame,
} from "../client/frame_adapter.js";

import type { ViewerFrame } from "./frame_views.js";
import { InspectionWork, ObsoleteInspection } from "./inspection_work.js";

export interface Session {
  frame: ViewerFrame;
  usage: CatalogueUsage | undefined;
  ready: Promise<MountedFrame>;
  mounted?: MountedFrame;
  controller: AbortController;
  unsubscribe?: () => void;
}

/** Cancellation settles callers even when a host adapter finishes late. */
export function frameSession(
  frame: ViewerFrame,
  url: URL,
  adapter: FrameAdapter,
  receive: (event: FrameEvent) => void,
  fail: (error: unknown) => Error,
): Session {
  const controller = new AbortController();
  const signal = controller.signal;
  const ready = new Promise<MountedFrame>((resolve, reject) => {
    const abort = () => reject(new ObsoleteInspection());
    signal.addEventListener("abort", abort, { once: true });
    void Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return adapter.mount(frame.element, {
          url,
          usage: frame.view?.usage ?? { status: "unavailable" },
          signal,
        });
      })
      .then((mounted) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) {
          mounted.dispose();
          return;
        }
        session.mounted = mounted;
        session.unsubscribe = mounted.subscribe((event) => {
          if (!signal.aborted) receive(event);
        });
        resolve(mounted);
      })
      .catch((error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      });
  }).catch((error) => {
    throw signal.aborted ? error : fail(error);
  });
  const session: Session = {
    frame,
    usage: frame.view?.usage,
    controller,
    ready,
  };
  void ready.catch(() => {});
  return session;
}

/** Refresh evidence on retained documents; older custom adapters keep mount semantics. */
export function refreshFrameSessions(
  sessions: readonly Session[],
  frames: readonly ViewerFrame[],
  fail: (error: unknown) => Error,
): boolean {
  if (
    sessions.length !== frames.length ||
    sessions.some(({ frame, usage, mounted }, index) => {
      const next = frames[index]!;
      return (
        frame.element !== next.element ||
        frame.url !== next.url ||
        frame.entry.id !== next.entry.id ||
        frame.stepIndex !== next.stepIndex ||
        frame.variantId !== next.variantId ||
        frame.view?.viewport !== next.view?.viewport ||
        frame.view?.colorScheme !== next.view?.colorScheme ||
        (usage !== next.view?.usage && !mounted?.updateUsage)
      );
    })
  )
    return false;
  for (const [index, session] of sessions.entries()) {
    const next = frames[index]!;
    const usage = next.view?.usage;
    Object.assign(session.frame, next);
    if (session.usage === usage) continue;
    session.usage = usage;
    const work = new InspectionWork(session.controller.signal, () => true);
    const update = () =>
      work.run(async () => {
        const mounted = session.mounted!;
        await mounted.updateUsage!(usage ?? { status: "unavailable" });
        return mounted;
      }, fail);
    session.ready = session.ready.then(update, update);
    void session.ready.catch(() => {});
  }
  return true;
}
