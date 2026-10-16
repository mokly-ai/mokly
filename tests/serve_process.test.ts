import assert from "node:assert/strict";
import test from "node:test";

import {
  processTree,
  running,
  spawnServe,
} from "../scripts/release/serve_process.mjs";

import { fileFixture } from "./helpers/file_fixture.js";
import { consumer, shim } from "./helpers/mokly_serve.js";

const entries = `import React from 'react'; import {defineScreen} from '@mokly/mokly';
export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],render:()=>React.createElement('main',null,'Home')});`;

test(
  "a failed setup leaves no Serve or sidecar process",
  {
    skip: process.platform === "win32" ? "process groups are POSIX" : false,
    timeout: 120_000,
  },
  async (context) => {
    const root = await consumer(context, {
      "specs/entries.mockup.ts": entries,
    });
    let teardown: (() => Promise<void>) | undefined;
    let pids: number[] = [];
    const served = fileFixture(
      async (owner) => {
        const server = spawnServe(
          shim,
          ["--no-watch", "--port", "0", "--sidecars", "1"],
          { cwd: root },
        );
        owner.after(async () => {
          await server.stop();
        });
        // An expected-state allowance for the listening line.
        const url = await server.listening(AbortSignal.timeout(60_000));
        const view = await fetch(
          `${url}/static/mokly-generated/home/index.mobile.html`,
        );
        assert.equal(view.status, 200);
        // The render started a sidecar, which the binary puts in its own group.
        const tree = processTree(server.child.pid!);
        assert.ok(
          tree.some(({ command }) => command.includes("sidecar")),
          JSON.stringify(tree),
        );
        pids = [server.child.pid!, ...tree.map(({ pid }) => pid)];
        throw new Error("setup failed deliberately");
      },
      (hook) => {
        teardown = hook;
      },
    );
    await assert.rejects(served(), /setup failed deliberately/);
    await teardown!();
    assert.ok(pids.length > 2, `Serve, the binary, and a sidecar: ${pids}`);
    assert.deepEqual(running(pids), []);
  },
);
