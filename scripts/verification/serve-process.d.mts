import type { ChildProcess } from "node:child_process";
export function serveProcess(
  args: readonly string[],
  cwd: string,
): Promise<{
  child: ChildProcess;
  signal(value: NodeJS.Signals): void;
  start(): Promise<void>;
  drain(): Promise<void>;
}>;
