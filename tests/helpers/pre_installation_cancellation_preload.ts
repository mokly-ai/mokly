import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const phase = process.env["MOKLY_TEST_PREINSTALL_PHASE"];

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
