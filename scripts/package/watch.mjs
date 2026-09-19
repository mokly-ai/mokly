import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startCommand, stopCommand, waitForOutput } from "./command.mjs";

export async function smokeExternalWatch(root) {
  const bin = path.join(root, "node_modules/.bin/mokly");
  const running = startCommand(bin, ["serve", "--port", "0"], { cwd: root });
  try {
    const match = await waitForOutput(
      running,
      /Mokly listening at (http:\/\/[^\s]+)/,
      "themed-consumer watched server",
    );
    const response = await fetch(`${match[1]}/__mokly/events`);
    assert.ok(response.body);
    const reader = response.body.getReader();
    await readServerEvent(reader, "ready");
    await fs.promises.writeFile(
      path.join(root, "external/templates.json"),
      '{"template":"updated"}\n',
    );
    await readServerEvent(reader, "update");
    await reader.cancel();
  } finally {
    const code = await stopCommand(running);
    assert.equal(code, 0);
  }
}

async function readServerEvent(reader, expected) {
  const decoder = new TextDecoder();
  let pending = "";
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await readWithTimeout(reader, expected);
    if (result.done) throw new Error("update stream closed unexpectedly");
    pending += decoder.decode(result.value, { stream: true });
    const boundary = pending.indexOf("\n\n");
    if (boundary === -1) continue;
    const event = pending.slice(0, boundary);
    if (event.includes(`event: ${expected}`)) return;
    pending = pending.slice(boundary + 2);
  }
  throw new Error(`timed out waiting for ${expected}`);
}

function readWithTimeout(reader, expected) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${expected}`)),
      20_000,
    );
    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
