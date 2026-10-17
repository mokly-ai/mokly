/** Signal only known processes; negative values are reserved for owned groups. */
export function validPid(
  pid: number | undefined,
  self = process.pid,
): pid is number {
  return Number.isSafeInteger(pid) && pid! > 1 && pid !== self;
}
export function killProcesses(
  pids: readonly number[],
  kill: (pid: number, signal: NodeJS.Signals) => void,
  self = process.pid,
) {
  for (const pid of new Set(pids.toReversed())) {
    if (!validPid(pid, self)) continue;
    try {
      kill(pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
}
