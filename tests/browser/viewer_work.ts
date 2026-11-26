import type { JSHandle } from "@playwright/test";

/**
 * Wait until the promise in `work` of the held page object settles, and
 * return its settled value. A rejection of `work` rejects the call.
 *
 * Use it instead of a `page.evaluate` that awaits viewer work. Chromium's
 * protocol holds the promise of an evaluation only weakly. When the promise
 * settles in a later task, nothing else may reference it until the protocol
 * reply, one microtask later and behind the microtasks of the work, such as
 * viewer renders. A garbage collection in that gap loses the reply
 * ("Promise was collected"), and Playwright reports "Execution context was
 * destroyed, most likely because of a navigation". Here a handle holds the
 * object, so the page keeps `work` until the reply.
 *
 * `page.evaluateHandle` returns the object at once, without awaiting `work`:
 *
 *     await awaitViewerWork(
 *       page.evaluateHandle(() => ({
 *         work: (async () => {
 *           await window.evidence.frames.startPick();
 *           window.evidence.update("mobile");
 *         })(),
 *       })),
 *     );
 */
export async function awaitViewerWork<Value>(
  holding: Promise<JSHandle<{ work: Promise<Value> }>>,
): Promise<Value> {
  const holder = await holding;
  try {
    // `evaluateHandle` awaits `work` itself. `evaluate` would await a new
    // promise that only the protocol references.
    const settled = await holder.evaluateHandle(({ work }) => work);
    try {
      return await settled.jsonValue();
    } finally {
      await settled.dispose();
    }
  } finally {
    await holder.dispose();
  }
}
