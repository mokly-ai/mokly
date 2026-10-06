/** Command gate released only after the parent establishes platform ownership. */
import { spawn } from "node:child_process";

interface CommandMessage {
  readonly argv: readonly [string, ...string[]];
}

function isCommandMessage(message: unknown): message is CommandMessage {
  if (!message || typeof message !== "object" || !("argv" in message))
    return false;
  const argv = message.argv;
  return (
    Array.isArray(argv) &&
    argv.length > 0 &&
    argv.every((part: unknown) => typeof part === "string")
  );
}

function finish(code: number): void {
  process.exitCode = code;
  if (process.connected) process.disconnect?.();
}

process.once("message", (message: unknown) => {
  if (!isCommandMessage(message)) {
    finish(1);
    return;
  }
  const [executable, ...args] = message.argv;
  try {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.once("error", (error) => {
      process.stderr.write(`${error.message}\n`);
      finish(1);
    });
    child.once("exit", (code) => finish(code ?? 1));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    finish(1);
  }
});
