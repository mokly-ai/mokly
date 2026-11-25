/**
 * The end of a test's happy-dom window. A commit outside `act`, such as one
 * that a resolved fetch starts, queues its passive effects as a task on React
 * DOM's scheduler. An unmount runs those effects at once, but the queued task
 * stays, and it reads `window` when it runs. So the window stays until the
 * scheduler has run every task that React queued before the teardown.
 */

import { createRequire } from "node:module";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

/** The part of the `scheduler` package that the teardown uses. */
interface Scheduler {
  unstable_IdlePriority: number;
  unstable_scheduleCallback(priority: number, callback: () => null): unknown;
}

function isScheduler(value: unknown): value is Scheduler {
  return (
    typeof value === "object" &&
    value !== null &&
    "unstable_IdlePriority" in value &&
    typeof value.unstable_IdlePriority === "number" &&
    "unstable_scheduleCallback" in value &&
    typeof value.unstable_scheduleCallback === "function"
  );
}

/**
 * React DOM's own copy of the scheduler, resolved from React DOM: a task on
 * another copy would not wait for React's tasks.
 */
function reactScheduler(): Scheduler {
  const reactDom = createRequire(import.meta.url).resolve("react-dom");
  const loaded: unknown = createRequire(reactDom)("scheduler");
  if (!isScheduler(loaded))
    throw new Error("React DOM's scheduler has no idle-priority callbacks");
  return loaded;
}

const scheduler = reactScheduler();

/**
 * Remove the window after React's queued work. The scheduler runs its tasks
 * in the order of their expiry, and an idle-priority task expires after
 * every other task, so React's queued tasks run first, with the window.
 */
export async function unregisterDom(): Promise<void> {
  await new Promise<void>((resolve) => {
    scheduler.unstable_scheduleCallback(scheduler.unstable_IdlePriority, () => {
      resolve();
      return null;
    });
  });
  await GlobalRegistrator.unregister();
}
