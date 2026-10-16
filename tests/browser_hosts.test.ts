import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { browserHost, serveHost } from "./browser/hosts.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("the static host serves exact files and directory indexes on a free port", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-browser-host-"));
  const host = await browserHost({ kind: "static", directory: root });
  context.after(async () => {
    await host.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(root, "index.html"), "<p>Static catalogue</p>");
  assert.equal(await (await fetch(host.url)).text(), "<p>Static catalogue</p>");
  assert.equal((await fetch(`${host.url}/missing`)).status, 404);
  await Promise.all([host.close(), host.close()]);
});

test("Serve host reports a startup failure and drains its failed child", async () => {
  await assert.rejects(
    serveHost(
      [
        "--eval",
        "process.stderr.write('fixture startup failure');process.exitCode=7",
      ],
      repositoryRoot,
    ),
    /startup and cleanup failed/,
  );
});
