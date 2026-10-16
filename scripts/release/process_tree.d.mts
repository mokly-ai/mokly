/** One live process below a root process. */
export interface TreeProcess {
  pid: number;
  ppid: number;
  pgid: number;
  zombie: boolean;
  command: string;
}

/** Every live process below `pid`, from one `ps` listing. */
export function processTree(pid: number): TreeProcess[];

/**
 * The recorded processes that still run: the same PID in the same process
 * group, and not an exited zombie.
 */
export function running<T extends { pid: number; pgid: number }>(
  processes: readonly T[],
): T[];
