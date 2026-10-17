import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  running,
  type TreeProcess,
} from "../scripts/verification/process-tree.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import { consumer, shim } from "./helpers/mokly_serve.js";

test(
  "an interrupted test worker leaves no Serve or sidecar group",
  {
    skip: process.platform === "win32" ? "process groups are POSIX" : false,
    timeout: 120_000,
  },
  async (context) => {
    const root = await consumer(context, {
      "specs/entries.mockup.ts": `import React from 'react'; import {defineScreen} from '@mokly/mokly';
export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],render:()=>React.createElement('main',null,'Home')});`,
    });
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const wrapper = spawn(
      process.execPath,
      [
        path.join(
          repositoryRoot,
          "scripts/verification/_fixtures_/serve-interrupt.mjs",
        ),
        "wrapper",
        root,
        shim,
      ],
      { env: environment, stdio: ["ignore", "pipe", "pipe"] },
    );
    const closed = once(wrapper, "close");
    let stderr = "";
    wrapper.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    let tree: TreeProcess[] = [];
    try {
      const lines = createInterface({
        input: wrapper.stdout,
        signal: AbortSignal.timeout(60_000),
      });
      for await (const line of lines) {
        tree = JSON.parse(line) as TreeProcess[];
        break;
      }
      assert.ok(
        tree.some(({ command }) => command.includes("sidecar")),
        stderr,
      );
      wrapper.kill("SIGTERM");
      const [code] = await closed;
      assert.equal(code, 1, stderr);
      assert.deepEqual(running(tree), []);
    } finally {
      if (wrapper.exitCode === null && wrapper.signalCode === null)
        wrapper.kill("SIGTERM");
      await closed;
      // Only the captured fixture groups belong to this test.
      for (const { pgid } of running(tree)) {
        try {
          process.kill(-pgid, "SIGKILL");
        } catch (error) {
          assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
        }
      }
    }
  },
);
