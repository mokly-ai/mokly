import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

/** One live process below a Serve shim. */
export interface ServeProcess {
  pid: number;
  ppid: number;
  pgid: number;
  zombie: boolean;
  command: string;
}

/** Exit state of the shim after its process group drained. */
export interface ServeOutcome {
  code: number | null;
  signal: NodeJS.Signals | null;
}

/** A `mokly serve` shim in its own process group. */
export interface ServeGroup {
  child: ChildProcessByStdio<null, Readable, Readable>;
  stderr(): string;
  /** The URL from Serve's listening line; the signal bounds the wait. */
  listening(signal: AbortSignal): Promise<string>;
  /** Interrupt Serve, kill what stays, and confirm that every process ended. */
  stop(): Promise<ServeOutcome>;
}

/** Every live process below `pid`, from one `ps` listing. */
export function processTree(pid: number): ServeProcess[];

/** The listed processes that still run; an exited zombie counts as gone. */
export function running(pids: readonly number[]): number[];

/** Start `node {shim} serve {args}` in its own process group. */
export function spawnServe(
  shim: string,
  args: readonly string[],
  options: { cwd: string; env?: Readonly<Record<string, string>> },
): ServeGroup;
