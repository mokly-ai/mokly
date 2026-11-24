/** One deployment check for the comparison operations that start together. */

import type { DeploymentCheck } from "../catalogue/sources.js";

/**
 * One deployment check for the operations that start together, so the shell
 * checks the deployment once for each change, not once for each row. Each
 * operation awaits the same check under its own signal: one operation's
 * cancel leaves the check to the others, and the check stops once no
 * operation waits for it.
 */
export function shareDeploymentCheck(check: DeploymentCheck): DeploymentCheck {
  const controller = new AbortController();
  let shared: Promise<boolean> | undefined;
  let waiting = 0;
  return (signal) =>
    new Promise<boolean>((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      shared ??= check(controller.signal);
      const result = shared;
      let waits = true;
      waiting += 1;
      const leave = () => {
        waits = false;
        waiting -= 1;
        signal.removeEventListener("abort", cancel);
      };
      const cancel = () => {
        leave();
        if (waiting === 0) controller.abort();
        reject(signal.reason);
      };
      signal.addEventListener("abort", cancel, { once: true });
      result.then(
        (same) => {
          if (!waits) return;
          leave();
          resolve(same);
        },
        (error: unknown) => {
          if (!waits) return;
          leave();
          reject(error);
        },
      );
    });
}
