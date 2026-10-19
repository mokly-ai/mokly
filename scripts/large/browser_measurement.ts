/** One owner closes the scenario context and drains its cleanup before returning. */
import type { BrowserContext } from "@playwright/test";

export async function browserMeasurement<Task extends Promise<unknown>>(
  context: Pick<BrowserContext, "close">,
  server: Promise<void>,
  task: Task,
) {
  try {
    return await Promise.race([
      task,
      server.then(() => {
        throw new Error("Serve stopped before browser verification");
      }),
    ]);
  } finally {
    try {
      await context.close();
    } finally {
      await task.catch(() => {});
    }
  }
}
