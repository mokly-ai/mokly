import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createVerificationProcessOwner } from "../scripts/verification/process-owner.mjs";
import {
  processTree,
  running,
  type TreeProcess,
} from "../scripts/verification/process-tree.mjs";
import { spawnServe } from "../scripts/verification/serve-process.mjs";

import { fileFixture } from "./helpers/file_fixture.js";
import { consumer, shim } from "./helpers/mokly_serve.js";

const entries = `import React from 'react'; import {defineScreen} from '@mokly/mokly';
export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],render:()=>React.createElement('main',null,'Home')});`;

const posixOnly = {
  skip: process.platform === "win32" ? "process groups are POSIX" : false,
  timeout: 120_000,
};

test(
  "a failed setup leaves no Serve or sidecar process",
  posixOnly,
  async (context) => {
    const root = await consumer(context, {
      "specs/entries.mockup.ts": entries,
    });
    let teardown: (() => Promise<void>) | undefined;
    let recorded: TreeProcess[] = [];
    const served = fileFixture(
      async (owner) => {
        const server = await spawnServe(
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
        recorded = tree;
        throw new Error("setup failed deliberately");
      },
      (hook) => {
        teardown = hook;
      },
    );
    try {
      await assert.rejects(served(), /setup failed deliberately/);
    } finally {
      // Drain before the consumer directory goes, whatever setup did.
      await teardown!();
    }
    assert.ok(recorded.length > 1, `the binary and a sidecar: ${recorded}`);
    assert.deepEqual(running(recorded), []);
  },
);

test(
  "the verification registry names Serve's group until it drains",
  posixOnly,
  async (context) => {
    const root = await consumer(context, {
      "specs/home.screen.html": "---\ntitle: Home\n---\n<main>Home</main>\n",
    });
    const owner = await createVerificationProcessOwner({ cwd: root });
    const env = owner.environment();
    const registry = env.MOKLY_VERIFICATION_PROCESS_REGISTRY!;
    const server = await spawnServe(shim, ["--no-watch", "--port", "0"], {
      cwd: root,
      env,
    });
    let outcome: Awaited<ReturnType<typeof server.stop>> | undefined;
    try {
      const records = await Promise.all(
        (await fs.readdir(registry))
          .filter(
            (name) => name.startsWith("process-") && name.endsWith(".json"),
          )
          .map(async (name) =>
            JSON.parse(await fs.readFile(path.join(registry, name), "utf8")),
          ),
      );
      const registered = records.filter(
        (record) => record.processGroupId === server.child.pid,
      );
      assert.equal(registered.length, 1);
      assert.equal(registered[0].schemaVersion, 1);
      assert.notEqual(registered[0].ownerId, env.MOKLY_VERIFICATION_OWNER_ID);
      await server.listening(AbortSignal.timeout(60_000));
    } finally {
      outcome = await server.stop();
      await owner.dispose();
    }
    assert.equal(outcome.code, 0, server.stderr());
  },
);

test(
  "forced owner cleanup drains Serve and its separate sidecar groups",
  posixOnly,
  async (context) => {
    const root = await consumer(context, {
      "specs/entries.mockup.ts": entries,
    });
    const owner = await createVerificationProcessOwner({ cwd: root });
    const server = await spawnServe(
      shim,
      ["--no-watch", "--port", "0", "--sidecars", "1"],
      {
        cwd: root,
        env: owner.environment(),
      },
    );
    let tree: TreeProcess[];
    try {
      const url = await server.listening(AbortSignal.timeout(60_000));
      assert.equal(
        (await fetch(`${url}/static/mokly-generated/home/index.mobile.html`))
          .status,
        200,
      );
      tree = processTree(server.child.pid!);
      assert.ok(
        tree.some(
          ({ command, pgid }) =>
            command.includes("sidecar") && pgid !== server.child.pid,
        ),
      );
      await owner.terminate("SIGKILL");
    } finally {
      await server.stop();
      await owner.dispose();
    }
    assert.deepEqual(running(tree), []);
  },
);
