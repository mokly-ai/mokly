/** Cancellable Git commands settle only after the process and its pipes close. */
import { spawn, type ChildProcess } from "node:child_process";

const TERMINATION_GRACE_MS = 1000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/** Preserve exit status for commands where a nonzero result has a defined meaning. */
export class GitProcessError extends Error {
  constructor(
    readonly exitCode: number | null,
    readonly signal: NodeJS.Signals | null,
    stderr: string,
  ) {
    super(`Git exited with ${exitCode ?? signal}: ${stderr}`);
    this.name = "GitProcessError";
  }
}

export async function executeGit(
  cwd: string,
  arguments_: readonly string[],
  signal?: AbortSignal,
  input?: Uint8Array,
): Promise<Uint8Array> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let failure: Error | undefined;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const grouped = signal !== undefined && process.platform !== "win32";
    const child = spawn("git", [...arguments_], { cwd, detached: grouped });
    const stop = () => {
      if (timer) return;
      terminate(child, grouped, "SIGTERM");
      timer = setTimeout(
        () => terminate(child, grouped, "SIGKILL"),
        TERMINATION_GRACE_MS,
      );
    };
    const aborted = () => {
      failure = new Error("The operation was aborted", {
        cause: signal?.reason,
      });
      failure.name = "AbortError";
      stop();
    };
    const capture = (buffers: Buffer[], name: string) => {
      let bytes = 0;
      return (chunk: Buffer) => {
        if (failure) return;
        bytes += chunk.byteLength;
        if (bytes > MAX_OUTPUT_BYTES) {
          failure = new Error(`${name} maxBuffer length exceeded`);
          stop();
        } else buffers.push(chunk);
      };
    };
    child.stdout.on("data", capture(stdout, "stdout"));
    child.stderr.on("data", capture(stderr, "stderr"));
    child.once("error", (error) => {
      failure ??= error;
    });
    child.once("close", (code, signalName) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new GitProcessError(
            code,
            signalName,
            Buffer.concat(stderr).toString("utf8"),
          ),
        );
      else resolve(Buffer.concat(stdout));
    });
    child.stdin?.on("error", (error) => {
      failure ??= error;
      stop();
    });
    if (input !== undefined) child.stdin?.end(Buffer.from(input));
    signal?.addEventListener("abort", aborted, { once: true });
  });
}

function terminate(
  child: ChildProcess,
  grouped: boolean,
  signal: NodeJS.Signals,
): void {
  if (grouped && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill(signal);
    }
  }
  if (child.exitCode === null && child.signalCode === null) child.kill(signal);
}
