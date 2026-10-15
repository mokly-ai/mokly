import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

/** Wait for the installed server's URL, request its shell, and stop it. */
export async function smokeServe(root, shim) {
  const child = spawn(
    process.execPath,
    [shim, "serve", "--port", "0", "--no-watch"],
    {
      cwd: root,
      env: { ...process.env, MOKLY_OUTPUT: "plain" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = once(child, "close");
  let output = "";
  let timer;
  try {
    const url = await new Promise((resolve, reject) => {
      const read = (chunk) => {
        output += String(chunk);
        const match = /http:\/\/[a-zA-Z0-9.:/]+/.exec(output);
        if (match) resolve(match[0]);
      };
      child.stdout.on("data", read);
      child.stderr.on("data", read);
      child.once("error", reject);
      child.once("exit", (code) =>
        reject(new Error(`installed Serve exited ${code}: ${output}`)),
      );
      timer = setTimeout(
        () =>
          reject(new Error(`installed Serve did not become ready: ${output}`)),
        60_000,
      );
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<html|<!doctype/i);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGTERM");
    const guard = setTimeout(() => child.kill("SIGKILL"), 10_000);
    await closed;
    clearTimeout(guard);
  }
}
