import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { NodeChildFactory } from "../packages/mokly/dist/server/child_process.js";
import { ReadyProcessSupervisor } from "../packages/mokly/dist/server/supervisor.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { ObservedChildFactory } from "./helpers/observed_child.js";
import { settle } from "./helpers/supervised_child.js";

test(
  "a transport failure force-kills an unresponsive server before reusing its port",
  { timeout: 10_000 },
  async (context) => {
    const fixture = await createFixture();
    const script = path.join(fixture.root, "unresponsive-child.mjs");
    await fs.writeFile(
      script,
      `import http from "node:http";
process.on("SIGTERM", () => {});
process.on("message", () => {});
const portIndex = process.argv.indexOf("--port");
const port = Number(process.argv[portIndex + 1]);
const server = http.createServer((_request, response) => response.end("running"));
server.listen(port, "127.0.0.1", () => process.send({ type: "ready", port: server.address().port }));
`,
    );
    const factory = new ObservedChildFactory(new NodeChildFactory(script));
    context.after(async () => {
      await factory.close();
      await removeFixture(fixture);
    });
    const supervisor = new ReadyProcessSupervisor(factory, [], 0, {
      gracefulMilliseconds: 30,
      terminateMilliseconds: 30,
    });
    const failures: Error[] = [];
    supervisor.onUnexpectedExit((error) => failures.push(error));
    const port = await supervisor.start();
    assert.equal(
      await (await fetch(`http://127.0.0.1:${port}`)).text(),
      "running",
    );
    const first = factory.children[0]!;
    first.fail?.(new Error("injected transport failure"));
    await supervisor.close();
    assert.equal(
      first.exited,
      true,
      "failed-child close must retain the live OS process",
    );
    assert.equal(first.terminations, 1);
    assert.equal(first.forceKills, 1);
    assert.equal(failures.length, 1);
    let replayed = false;
    first.handle.onExit(() => {
      replayed = true;
    });
    await settle();
    assert.equal(replayed, true, "late cleanup sees retained terminal state");

    assert.equal(await supervisor.start(), port);
    assert.equal(factory.children.length, 2);
    assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
    await supervisor.close();
    assert.equal(factory.children[1]!.exited, true);
  },
);
