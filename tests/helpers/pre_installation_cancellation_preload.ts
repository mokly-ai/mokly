import childProcess, { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const phase = process.env["MOKLY_TEST_PREINSTALL_PHASE"];

if (phase === "compile") delaySigintListeners(captureEsbuildServiceEnd());

if (phase === "staging") {
  const original = fs.promises.writeFile;
  let signalled = false;
  Object.defineProperty(fs.promises, "writeFile", {
    configurable: true,
    value: async (...args: unknown[]) => {
      const candidate = String(args[0]);
      if (
        !signalled &&
        candidate.includes(
          `${path.sep}.mokly-export-reservations${path.sep}`,
        ) &&
        candidate.includes(`${path.sep}stage${path.sep}`)
      ) {
        signalled = true;
        await signalProcessGroup();
      }
      return Reflect.apply(original, fs.promises, args);
    },
    writable: true,
  });
}

async function signalProcessGroup(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const helper = spawn(
      process.execPath,
      ["-e", 'process.kill(-process.ppid, "SIGINT")'],
      { stdio: "ignore" },
    );
    helper.once("error", reject);
    helper.once("close", () => resolve());
  });
}

function captureEsbuildServiceEnd(): () => Promise<void> {
  const original = childProcess.spawn;
  let serviceEnd: Promise<void> | undefined;
  childProcess.spawn = ((...arguments_: Parameters<typeof spawn>) => {
    const child = Reflect.apply(original, childProcess, arguments_);
    if (String(arguments_[0]) === process.env["ESBUILD_BINARY_PATH"]) {
      const stdout = child.stdout;
      if (!stdout) throw new Error("esbuild service stdout was not piped");
      serviceEnd = new Promise((resolve) => stdout.once("end", resolve));
    }
    return child;
  }) as typeof spawn;
  return async () => {
    await serviceEnd;
  };
}

function delaySigintListeners(waitForEsbuildEnd: () => Promise<void>): void {
  type Listener = (...arguments_: unknown[]) => void;
  const originalOn = process.on;
  const originalOff = process.off;
  const registered = new WeakMap<Listener, Listener>();
  process.on = ((event: string | symbol, listener: Listener) => {
    if (event !== "SIGINT")
      return Reflect.apply(originalOn, process, [event, listener]);
    const delayed: Listener = (...arguments_) => {
      void waitForEsbuildEnd().then(() => {
        setImmediate(() => Reflect.apply(listener, process, arguments_));
      });
    };
    registered.set(listener, delayed);
    return Reflect.apply(originalOn, process, [event, delayed]);
  }) as typeof process.on;
  process.off = ((event: string | symbol, listener: Listener) =>
    Reflect.apply(originalOff, process, [
      event,
      event === "SIGINT" ? (registered.get(listener) ?? listener) : listener,
    ])) as typeof process.off;
}
