export async function cleanupAll(steps: Array<() => Promise<void>>) {
  const errors: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "Publication cleanup failed");
}
