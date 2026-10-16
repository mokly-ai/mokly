import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  processTree,
  running,
  type TreeProcess,
} from "../scripts/release/process_tree.mjs";
import { spawnServe } from "../scripts/release/serve_process.mjs";

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
    const registry = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-owner-"));
    context.after(() => fs.rm(registry, { recursive: true, force: true }));
    const ownerId = randomUUID();
    const server = spawnServe(shim, ["--no-watch", "--port", "0"], {
      cwd: root,
      env: {
        MOKLY_VERIFICATION_PROCESS_REGISTRY: registry,
        MOKLY_VERIFICATION_OWNER_ID: ownerId,
      },
    });
    let outcome: Awaited<ReturnType<typeof server.stop>> | undefined;
    try {
      const files = await fs.readdir(registry);
      assert.equal(files.length, 1);
      assert.match(files[0]!, /^process-[0-9a-f-]{36}\.json$/u);
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(registry, files[0]!), "utf8")),
        {
          schemaVersion: 1,
          type: "process",
          ownerId,
          processGroupId: server.child.pid,
        },
      );
      await server.listening(AbortSignal.timeout(60_000));
    } finally {
      outcome = await server.stop();
    }
    assert.equal(outcome.code, 0, server.stderr());
    assert.deepEqual(await fs.readdir(registry), []);
  },
);
