/** Dispatch at most `limit` independent tasks, stopping admission on failure. */
export async function runLocalTasks(tasks, limit, run, cancel) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Invalid worker limit");
  let next = 0;
  let failure;
  async function worker() {
    while (next < tasks.length && !failure) {
      const task = tasks[next++];
      try {
        await run(task);
      } catch (error) {
        if (!failure) {
          failure = error;
          await cancel().catch((cleanupError) => {
            failure = new AggregateError(
              [error, cleanupError],
              "Worker cancellation failed",
              { cause: error },
            );
          });
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
  );
  if (failure) throw failure;
}
