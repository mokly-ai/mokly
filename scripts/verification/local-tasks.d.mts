export function runLocalTasks<T>(
  tasks: readonly T[],
  limit: number,
  run: (task: T) => Promise<void>,
  cancel: () => Promise<void>,
): Promise<void>;
