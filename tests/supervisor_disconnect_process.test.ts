import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { NodeChildFactory } from "../packages/mokly/dist/server/child_process.js";
import { ReadyProcessSupervisor } from "../packages/mokly/dist/server/supervisor.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { ObservedChildFactory } from "./helpers/observed_child.js";
import { settlement } from "./helpers/supervised_child.js";

test(
  "child-initiated IPC loss restarts an unresponsive HTTP child on the same port",
  { timeout: 10_000 },
  async (context) => {
    const fixture = await createFixture();
    const script = path.join(fixture.root, "disconnecting-child.mjs");
    await fs.writeFile(
      script,
      `import http from "node:http";
let updates = 0;
process.on("SIGTERM", () => {});
process.on("message", message => { if (message.type === "update") updates++; });
const server = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/disconnect") {
    process.once("disconnect", () => response.end(JSON.stringify({ connected: process.connected })));
    process.disconnect();
  } else response.end(JSON.stringify({ updates, connected: process.connected }));
});
server.listen(Number(process.argv[process.argv.indexOf("--port") + 1]), "127.0.0.1", () => {
  process.send({ type: "ready", port: server.address().port });
});
`,
    );
    const factory = new ObservedChildFactory(new NodeChildFactory(script));
    context.after(async () => {
      supervisor.onUnexpectedExit(() => undefined);
      try {
        await restarting?.catch(() => undefined);
        await supervisor.close();
      } finally {
        await factory.close();
        await removeFixture(fixture);
      }
    });
    const supervisor = new ReadyProcessSupervisor(factory, [], 0, {
      gracefulMilliseconds: 100,
      terminateMilliseconds: 100,
    });
    const failures: Error[] = [];
    let restarting: Promise<number> | undefined;
    let failed: () => void = () => undefined;
    const failureObserved = new Promise<void>((resolve) => {
      failed = resolve;
    });
    supervisor.onUnexpectedExit((error) => {
      failures.push(error);
      restarting = supervisor.restart();
      settlement(restarting);
      failed();
    });
    const port = await supervisor.start();
    assert.deepEqual(await state(port), { connected: true, updates: 0 });
    assert.deepEqual(await state(port, "/disconnect"), { connected: false });
    await Promise.race([
      failureObserved,
      delay(1000, undefined, { ref: false }),
    ]);
    assert.equal(
      failures.length,
      1,
      "transport loss must report failure without another update",
    );
    assert.match(failures[0]!.message, /IPC disconnected/);
    const first = factory.children[0]!;
    let replayed = false;
    first.handle.onDisconnect(() => {
      replayed = true;
    });
    assert.equal(
      replayed,
      true,
      "late subscribers observe the disconnected channel",
    );
    assert.ok(restarting);
    assert.equal(await restarting, port);
    assert.deepEqual(factory.aliveBeforeSpawn, [false, false]);
    assert.equal(first.exited, true);
    assert.equal(first.terminations, 1);
    assert.equal(first.forceKills, 1);
    assert.deepEqual(await state(port), { connected: true, updates: 0 });
    supervisor.notifyUpdate(["home"]);
    let current = await state(port);
    for (let attempt = 0; attempt < 100 && current.updates === 0; attempt++) {
      await delay(10);
      current = await state(port);
    }
    assert.deepEqual(current, { connected: true, updates: 1 });
    await supervisor.close();
    assert.equal(factory.children[1]!.exited, true);
    assert.equal(
      failures.length,
      1,
      "intentional shutdown must not report IPC loss",
    );
  },
);

async function state(
  port: number,
  route = "/",
): Promise<{ connected: boolean; updates?: number }> {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 200);
  return response.json();
}
