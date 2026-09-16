import type {
  FrameAdapter,
  FrameEvent,
  MountedFrame,
} from "../client/frame_adapter.js";

import type { ViewerFrame } from "./frame_views.js";
import { ObsoleteInspection } from "./inspection_work.js";

export interface Session {
  frame: ViewerFrame;
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
  const session: Session = { frame, controller, ready };
  void ready.catch(() => {});
  return session;
}
