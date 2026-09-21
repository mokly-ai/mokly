/** Promise ownership for frame mount and evidence-update readiness. */

import type { MountedFrame } from "../client/frame_adapter.js";
import { FrameError } from "../client/frame_error.js";

interface InitialFrameReadiness {
  promise: Promise<MountedFrame>;
  reject(error: unknown): void;
  resolve(frame: MountedFrame): void;
}

interface AdoptedFrameReadiness {
  promise: Promise<MountedFrame>;
  reject(error: unknown): void;
}

/** Create readiness settled by the adapter that owns an initial mount. */
export function mountedFrameReadiness(): InitialFrameReadiness {
  let reject = (_error: unknown): void => undefined;
  let resolve = (_frame: MountedFrame): void => undefined;
  const promise = new Promise<MountedFrame>((ready, fail) => {
    resolve = ready;
    reject = fail;
  });
  return { promise, reject, resolve };
}

/** Fence adopted evidence readiness with explicit supersession and session abort. */
export function adoptedFrameReadiness(
  signal: AbortSignal,
  readiness: Promise<MountedFrame>,
): AdoptedFrameReadiness {
  let rejectReady = (_error: unknown): void => undefined;
  const promise = new Promise<MountedFrame>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", aborted);
      action();
    };
    const aborted = () => finish(() => reject(new FrameError("disposed")));
    rejectReady = (error) => finish(() => reject(error));
    if (signal.aborted) aborted();
    else signal.addEventListener("abort", aborted, { once: true });
    void readiness.then(
      (mounted) => finish(() => resolve(mounted)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
  return { promise, reject: rejectReady };
}
