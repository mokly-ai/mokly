import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { bundleParams, cssParams, sidecarFixture } from "./helpers/sidecar.js";

for (const operation of [false, true])
  test(
    `sidecar exits quietly when its parent closes stdout before ${operation ? "an operation count" : "a response"}`,
    { timeout: 30_000 },
    async (context) => {
      const child = spawn(
        process.execPath,
        [path.resolve("packages/mokly/dist/sidecar.js")],
        { stdio: "pipe" },
      );
      context.after(() => child.kill("SIGKILL"));
      const closed = once(child, "close");
      let stderr = "";
      child.stderr.on("data", (bytes) => {
        stderr += String(bytes);
      });
      if (operation) {
        const lines = createInterface({ input: child.stdout });
        const hello = once(lines, "line");
        child.stdin.write(
          JSON.stringify({ id: 0, method: "hello", params: {} }) + "\n",
        );
        assert.equal(JSON.parse((await hello)[0]).id, 0);
        lines.close();
      }
      const readClosed = once(child.stdout, "close");
      child.stdout.destroy();
      await readClosed;
      child.stdin.write(
        JSON.stringify({
          id: 1,
          method: operation ? "bundle" : "hello",
          params: operation
            ? bundleParams({
                entryFiles: ["screen.mockup.tsx"],
                storiesFiles: [],
              })
            : {},
        }) + "\n",
      );
      assert.deepEqual(await closed, [0, null], stderr);
      assert.equal(stderr, "");
    },
  );

for (const channel of ["stdout", "ipc"] as const)
  test(
    `PostCSS worker exits quietly when its parent closes ${channel} before a write`,
    { timeout: 30_000 },
    async (context) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-pipe-"));
      context.after(() => fs.rm(root, { recursive: true, force: true }));
      const worker = pathToFileURL(
        path.resolve("packages/mokly/dist/sidecar/postcss-worker.js"),
      ).href;
      await fs.writeFile(
        path.join(root, "worker.mjs"),
        `await import(${JSON.stringify(worker)});`,
      );
      await fs.writeFile(
        path.join(root, "postcss.mjs"),
        `export default {plugins:[{postcssPlugin:'pipe-test',async Once(){${channel === "stdout" ? "process.stdout.write('late output');" : "await new Promise(resolve=>{process.once('disconnect',resolve);process.send({ready:true});});"}}}]};`,
      );
      const child = fork(path.join(root, "worker.mjs"), {
        cwd: root,
        // Keep the test runner's loader and concurrency flags out of the
        // compiled worker's startup.
        execArgv: [],
        stdio: ["pipe", "pipe", "pipe", "ipc"],
      });
      context.after(() => child.kill("SIGKILL"));
      const closed = once(child, "exit");
      const drained = once(child.stderr!, "end");
      child.stdout!.resume();
      let stderr = "";
      child.stderr!.on("data", (bytes) => {
        stderr += String(bytes);
      });
      if (channel === "stdout") {
        const readClosed = once(child.stdout!, "close");
        child.stdout!.destroy();
        await readClosed;
      }
      const params = cssParams({
        sourceRoot: root,
        postcss: path.join(root, "postcss.mjs"),
        text: "p {}",
        moduleResolution: bundleParams().moduleResolution,
      });
      const ready = once(child, "message");
      child.send({
        ...params,
        sourceRoot: root,
        repositoryRoots: [sidecarFixture],
      });
      child.send({ id: 1, params });
      if (channel === "ipc") {
        assert.deepEqual(
          (
            await Promise.race([
              ready,
              closed.then(() => {
                throw new Error(stderr);
              }),
            ])
          )[0],
          { ready: true },
        );
        child.disconnect();
      } else void ready.catch(() => {});
      assert.deepEqual(await closed, [0, null], stderr);
      await drained;
      assert.equal(stderr, "");
    },
  );
