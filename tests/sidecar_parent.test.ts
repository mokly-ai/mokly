import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { pathToFileURL } from "node:url";

test(
  "the parent-pipe watchdog ends a process with a blocked main thread",
  { timeout: 30000 },
  async (context) => {
    const module = pathToFileURL(
      path.resolve("packages/mokly/dist/sidecar/parent-input.js"),
    ).href;
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import {parentInput} from ${JSON.stringify(module)}; const input=parentInput(); for await (const chunk of input.stream) { process.stdout.write('busy\\n'); while(true) {} }`,
      ],
      { stdio: "pipe" },
    );
    context.after(() => child.kill("SIGKILL"));
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const exit = once(child, "exit");
    const lines = createInterface({ input: child.stdout });
    const busy = once(lines, "line");
    child.stdin.write("render\n");
    assert.deepEqual(
      await Promise.race([
        busy,
        exit.then(() => {
          throw new Error(stderr);
        }),
      ]),
      ["busy"],
    );
    child.stdin.end();
    const [code, signal] = await exit;
    assert.ok(signal === "SIGKILL" || code !== 0, stderr);
  },
);
