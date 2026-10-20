import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { platformPackage } from "../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../packages/mokly/src/runtime.mjs";
import { listeningAddress } from "../scripts/verification/serve-process.mjs";

import { consumer } from "./helpers/mokly_serve.js";
import { workspace } from "./helpers/static_publication.js";

test(
  "Serve releases each replaced JavaScript generation while it stays open",
  { timeout: 120_000 },
  async (context) => {
    const cleanup: { stop?: () => Promise<void> } = {};
    context.after(async () => cleanup.stop?.());
    const screen = (label: string) =>
      `import React from 'react'; import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Home',description:'',relatedDocs:[],props:{},render:()=>React.createElement('p',null,${JSON.stringify(label)})});`;
    const file = "specs/home.mockup.ts";
    const root = await consumer(context, { [file]: screen("Initial") });
    const packageRoot = path.join(root, ".context/package");
    await fs.mkdir(path.join(packageRoot, "dist"), { recursive: true });
    await fs.writeFile(
      path.join(packageRoot, "package.json"),
      '{"type":"module"}',
    );
    const module = (name: string) =>
      pathToFileURL(path.join(workspace, "packages/mokly/dist", name)).href;
    await fs.writeFile(
      path.join(packageRoot, "dist/sidecar.js"),
      `import {Session} from ${JSON.stringify(module("sidecar/session.js"))};
const original = Session.prototype.call;
Session.prototype.call = async function(request) {
  const result = await original.call(this, request);
  if (request.method === 'bundle') process.stderr.write('lease-bundle '+result.generation+'\\n');
  if (request.method === 'dispose') process.stderr.write('lease-dispose '+request.params.generation+'\\n');
  return result;
};
await import(${JSON.stringify(module("sidecar.js"))});`,
    );
    const runtime = systemRuntime();
    const native = runtime.nativePackage(
      platformPackage(runtime.platform, runtime.architecture, runtime.glibc),
    );
    const child = spawn(
      native.binary,
      ["serve", "--watch", "--port=0", "--sidecars=1"],
      {
        cwd: root,
        env: {
          ...process.env,
          MOKLY_OUTPUT: "plain",
          MOKLY_PACKAGE_ROOT: packageRoot,
          MOKLY_NODE_EXECUTABLE: process.execPath,
          MOKLY_VIEWER_DIST: path.join(workspace, "packages/viewer/dist"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const exited = once(child, "close");
    const stop = () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGINT");
    };
    context.signal.addEventListener("abort", stop, { once: true });
    cleanup.stop = async () => {
      stop();
      await exited;
      context.signal.removeEventListener("abort", stop);
    };
    const events = new EventEmitter();
    let output = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        events.emit("output");
      });
    const signal = AbortSignal.any([
      context.signal,
      AbortSignal.timeout(30_000),
    ]);
    const wait = async (pattern: RegExp, start = 0) => {
      for (;;) {
        const match = pattern.exec(output.slice(start));
        if (match) return match;
        try {
          await Promise.race([
            once(events, "output", { signal }),
            exited.then(() => {
              throw new Error(`Serve exited before ${pattern}: ${output}`);
            }),
          ]);
        } catch (cause) {
          throw new Error(`Serve did not emit ${pattern}: ${output}`, {
            cause,
          });
        }
      }
    };
    await wait(/Mokly listening at http:\/\/127\.0\.0\.1:\d+[^\n]*\n/);
    const url = listeningAddress(output);
    assert.ok(url);
    const initial = (await wait(/lease-bundle ([a-f0-9]{64})/))[1]!;
    const response = await fetch(`${url}/mokly-viewer/events`, { signal });
    assert.equal(response.status, 200);
    assert.ok(response.body);
    const updates = response.body.getReader();
    try {
      let previous = initial;
      for (const label of ["Updated", "Replaced again"]) {
        const before = output.length;
        assert.doesNotMatch(output, new RegExp(`lease-dispose ${previous}`));
        await fs.writeFile(path.join(root, file), screen(label));
        for (;;) {
          const rendered = await fetch(
            `${url}/static/mokly-generated/home/index.mobile.html`,
            { signal },
          );
          assert.equal(rendered.status, 200);
          if ((await rendered.text()).includes(`>${label}<`)) break;
          await updates.read();
        }
        const current = (await wait(/lease-bundle ([a-f0-9]{64})/, before))[1]!;
        assert.notEqual(current, previous);
        context.diagnostic(
          `Published ${label}; waiting for disposal of ${previous}`,
        );
        await wait(new RegExp(`lease-dispose ${previous}`));
        assert.equal(child.exitCode, null);
        assert.equal(child.signalCode, null);
        previous = current;
      }
    } finally {
      if (!signal.aborted) await updates.cancel();
    }
    stop();
    assert.deepEqual(await exited, [0, null], output);
  },
);
