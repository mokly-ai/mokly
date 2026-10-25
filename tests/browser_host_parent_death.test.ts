import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import {
  processTree,
  running,
  type TreeProcess,
} from "../scripts/verification/process-tree.mjs";

import { serveHost } from "./browser/hosts.js";
import { consumer, shim } from "./helpers/mokly_serve.js";

test(
  "killing the Serve binary leaves no sidecar of its browser host",
  {
    skip:
      process.platform === "win32"
        ? "browser hosts require POSIX groups"
        : false,
    timeout: 120_000,
  },
  async (context) => {
    const root = await consumer(context, {
      "specs/entries.mockup.ts": `import React from 'react'; import {defineScreen} from '@mokly/mokly';
export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],render:()=>React.createElement('main',null,'Home')});`,
    });
    const host = await serveHost(
      [shim, "serve", "--no-watch", "--port", "0", "--sidecars", "1"],
      root,
    );
    let killed = false;
    let sidecars: TreeProcess[] = [];
    try {
      const response = await fetch(
        `${host.url}/static/mokly-generated/home/index.mobile.html`,
      );
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Home/);
      const binaries = processTree(process.pid).filter(({ command }) =>
        /[/\\]mokly serve(?: |$)/u.test(command),
      );
      assert.equal(binaries.length, 1);
      const binary = binaries[0]!;
      sidecars = processTree(binary.pid).filter(({ command }) =>
        /[/\\]sidecar\.js(?: |$)/u.test(command),
      );
      assert.ok(sidecars.length > 0, "the host must own a real sidecar");
      process.kill(binary.pid, "SIGKILL");
      killed = true;
      // Observe parent-death protection before invoking the host's tree drain.
      // This deadline is a hang guard; only the process state decides success.
      const signal = AbortSignal.timeout(10_000);
      while (running(sidecars).length > 0) {
        signal.throwIfAborted();
        await setImmediate();
      }
      assert.deepEqual(running(sidecars), []);
    } finally {
      try {
        if (killed)
          await assert.rejects(
            host.close(),
            /Example Serve did not stop cleanly/,
          );
        else await host.close();
      } finally {
        killSurvivingSidecars(sidecars);
      }
    }
  },
);

function killSurvivingSidecars(sidecars: TreeProcess[]): void {
  for (const { pgid } of running(sidecars)) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
}
