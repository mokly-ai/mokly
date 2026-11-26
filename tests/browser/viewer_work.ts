import type { Page } from "@playwright/test";

/** Page work that `window.holdViewerWork` holds for `awaitViewerWork`. */
export interface HeldViewerWork<Value> {
  readonly work: Promise<Value>;
  readonly held: true;
}

declare global {
  interface Window {
    holdViewerWork<Value>(work: Promise<Value>): HeldViewerWork<Value>;
  }
}

/**
 * Run `pageFunction` in the page, wait until the work that it holds settles,
 * and return the settled value. A rejection of the work rejects the call.
 *
 * Use it instead of a `page.evaluate` that awaits viewer work. Chromium's
 * protocol holds the promise of an evaluation only weakly. When the promise
 * settles in a later task, nothing else may reference it until the protocol
 * reply, one microtask later and behind the microtasks of the work, such as
 * viewer renders. A garbage collection in that gap loses the reply
 * ("Promise was collected"), and Playwright reports "Execution context was
 * destroyed, most likely because of a navigation". Here a handle holds the
 * object, so the page keeps the work until the reply.
 *
 * `window.holdViewerWork` attaches a rejection handler in the same call that
 * starts the work. A rejection before the second call then reaches only the
 * test, not the page's unhandled-rejection report that the error check reads.
 *
 *     await awaitViewerWork(page, () =>
 *       window.holdViewerWork(
 *         (async () => {
 *           await window.evidence.frames.startPick();
 *           window.evidence.update("mobile");
 *         })(),
 *       ),
 *     );
 */
export async function awaitViewerWork<Value, Arg = undefined>(
  page: Page,
  pageFunction: (arg: Arg) => HeldViewerWork<Value>,
  arg?: Arg,
): Promise<Value> {
  await page.evaluate(() => {
    window.holdViewerWork ??= (work) => {
      work.catch(() => {});
      return { work, held: true };
    };
  });
  // Playwright passes `arg` through serialization, so its page-side type is
  // `Unboxed<Arg>`. The callers pass plain values, for which the two agree.
  const holder = await page.evaluateHandle(
    pageFunction as (arg: unknown) => HeldViewerWork<Value>,
    arg,
  );
  try {
    // `evaluateHandle` awaits the work itself. `evaluate` would await a new
    // promise that only the protocol references.
    const settled = await holder.evaluateHandle(({ work }) => work);
    try {
      return (await settled.jsonValue()) as Value;
    } finally {
      await settled.dispose();
    }
  } finally {
    await holder.dispose();
  }
}
