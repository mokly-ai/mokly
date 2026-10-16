import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

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

/** Start `node {shim} serve {args}` in its own process group. */
export function spawnServe(
  shim: string,
  args: readonly string[],
  options: { cwd: string; env?: Readonly<Record<string, string>> },
): ServeGroup;
