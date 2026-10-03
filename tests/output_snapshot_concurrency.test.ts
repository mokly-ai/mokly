import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { outputLockPath } from "../dist/build/output_lock.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { runWithTimings } from "../dist/diagnostics/timings.js";

import { createFixture, repositoryRoot } from "./helpers/fixture.js";

function source(folder: string): string {
  return `import {defineScreen} from '@mokly/mokly';export const entries=Array.from({length:4},(_,i)=>defineScreen({path:'${folder}/screen-'+i,title:'Screen '+i,description:'A screen',dependencies:[],relatedDocs:[],mobile:'Mobile',desktop:'Desktop'}));`;
}
function message(child: ChildProcess, type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const receive = (value: { type: string; error?: string }) => {
      if (value.type === type) {
        cleanup();
        resolve();
      } else if (value.type === "failed") {
        cleanup();
        reject(new Error(value.error));
      }
    };
    const exit = () => {
      cleanup();
      reject(new Error(`writer exited before ${type}`));
    };
    const cleanup = () => {
      child.off("message", receive);
      child.off("exit", exit);
    };
    child.on("message", receive);
    child.once("exit", exit);
  });
}

for (const previous of ["fixture/Case", "fixture/old"])
  test(
    `compile snapshots wait for another process pruning ${previous}`,
    { timeout: 30_000 },
    async (t) => {
      const current = previous.endsWith("Case")
        ? "fixture/case"
        : "fixture/new";
      const fixture = await createFixture(source(previous));
      t.after(() => fixture.remove());
      const config = await loadConfig(fixture.root),
        before = await compileCatalogue(config);
      await fs.promises.writeFile(fixture.entryPath, source(current));
      const after = await compileCatalogue(await loadConfig(fixture.root));
      await fs.promises.writeFile(
        path.join(fixture.root, "writer-input.json"),
        JSON.stringify(
          [before, after].map((value) => ({
            ...value,
            outputs: [...value.outputs],
          })),
        ),
      );
      await writeCompilation(before, config);
      const child = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          path.join(repositoryRoot, "tests/helpers/output_snapshot_writer.ts"),
          fixture.root,
        ],
        { cwd: repositoryRoot, stdio: ["ignore", "ignore", "inherit", "ipc"] },
      );
      fixture.beforeRemove(async () => {
        if (child.exitCode === null) {
          const exited = once(child, "exit");
          child.kill();
          await exited;
        }
      });
      await message(child, "ready");
      for (let round = 0; round < 4; round++) {
        const paused = message(child, "paused");
        child.send({ type: "write", index: round % 2 === 0 ? 1 : 0 });
        await paused;
        assert.ok(fs.existsSync(outputLockPath(config.repoRoot)));
        let reached = () => {};
        const waiting = new Promise<void>((resolve) => {
          reached = resolve;
        });
        const read = runWithTimings(
          true,
          "test",
          () =>
            round % 2 === 0
              ? compileCatalogue(config)
              : prepareLiveRuntime(config),
          {
            write: (event) => {
              if (event.stage === "output.lock" && event.event === "start")
                reached();
            },
          },
        );
        const outcome = await Promise.race([
          waiting.then(() => "waiting"),
          read.then(
            () => "finished",
            (error) => String(error),
          ),
        ]);
        const done = message(child, "done");
        child.send({ type: "resume" });
        await done;
        assert.equal(
          outcome,
          "waiting",
          "validation must not capture the half-written output tree",
        );
        const accepted = await read;
        if ("bundle" in accepted) {
          const readdir = fs.readdirSync;
          let outputScans = 0;
          const spy = t.mock.method(fs, "readdirSync", (...args: unknown[]) => {
            if (String(args[0]) === config.mockupsDir) outputScans++;
            return Reflect.apply(readdir, fs, args);
          });
          const compiler = new DocumentCompiler(
            accepted,
            runtimeGraph(accepted),
          );
          compiler.render(`${current}/screen-0/index.mobile.html`);
          compiler.render(`${current}/screen-1/index.desktop.html`);
          assert.equal(
            outputScans,
            0,
            "demand rendering reuses the accepted locked snapshot",
          );
          spy.mock.restore();
        }
      }
    },
  );
